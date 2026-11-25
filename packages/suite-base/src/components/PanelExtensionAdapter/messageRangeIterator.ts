// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@lichtblick/log";
import { MessageEvent, Subscription } from "@lichtblick/suite";
import { CreateMessageRangeIteratorParams } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { BATCH_INTERVAL_MS } from "@lichtblick/suite-base/components/PanelExtensionAdapter/constants";

const log = Logger.getLogger(__filename);

/**
 * Resolves with the iterator's next result, or with `undefined` as soon as `signal` aborts, even
 * while the read is still pending. A result that settles after the abort is dropped (stale), which
 * also releases any buffers it carries to the GC. The listener is removed on settle so a
 * long-lived signal does not accumulate one listener per message.
 */
async function nextUnlessAborted<T>(
  iterator: AsyncIterator<T>,
  signal: AbortSignal,
): Promise<IteratorResult<T> | undefined> {
  if (signal.aborted) {
    return undefined;
  }
  const pending = iterator.next();
  return await new Promise<IteratorResult<T> | undefined>((resolve, reject) => {
    const onAbort = () => {
      resolve(undefined);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    pending.then(
      (result) => {
        signal.removeEventListener("abort", onAbort);
        resolve(signal.aborted ? undefined : result);
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/**
 * Creates an async iterable that processes messages from a raw batch iterator,
 * applying conversions and batching as needed.
 *
 * `cancel()` takes effect immediately: a consumer awaiting the next batch is released at once, no
 * batch is yielded afterwards, and the raw iterator chain is closed (its `return()` runs as soon as
 * any in-flight read settles, releasing worker cursors and pinned sources).
 */
export function createMessageRangeIterator(params: CreateMessageRangeIteratorParams): {
  iterable: AsyncIterable<MessageEvent[]>;
  cancel: () => void;
} {
  const {
    topic,
    convertTo,
    rawBatchIterator,
    sortedTopics,
    messageConverters,
    emitAlert,
    onBatch,
    abortController = new AbortController(),
    onQuiescent,
  } = params;

  const signal = abortController.signal;
  // Read through a function: the type checker would otherwise keep `signal.aborted` narrowed to
  // `false` across `await`/`yield`, where cancel() may have flipped it.
  const isAborted = (): boolean => signal.aborted;
  let cancelledAt: number | undefined;
  let rawIteratorClosed = false;

  // Close the raw chain exactly once. Not awaited by callers: if a read is in flight, return() is
  // queued behind it by the async generator protocol and must not block the cancelling caller.
  const closeRawIterator = (): void => {
    if (rawIteratorClosed) {
      return;
    }
    rawIteratorClosed = true;
    void (async () => {
      try {
        await rawBatchIterator.return?.();
      } catch (err: unknown) {
        log.debug("Error closing range iterator:", err);
      }
      if (cancelledAt != undefined) {
        const durationMs = performance.now() - cancelledAt;
        log.debug(`Range iterator for ${topic} quiescent ${durationMs.toFixed(1)}ms after cancel`);
        onQuiescent?.(durationMs);
      }
    })();
  };

  // Create a wrapper async iterable that converts IteratorResult to MessageEvent
  const messageEventIterable = {
    async *[Symbol.asyncIterator]() {
      try {
        if (isAborted()) {
          return;
        }

        // Create a fake subscription to get message converters for this topic
        // Include convertTo if specified to get proper conversion setup
        const subscription: Subscription = convertTo
          ? { topic, preload: true, convertTo }
          : { topic, preload: true };

        // Import necessary functions for message processing
        const { convertMessage, collateTopicSchemaConversions } = await import(
          "./messageProcessing"
        );

        const collatedConversions = collateTopicSchemaConversions(
          [subscription],
          sortedTopics,
          messageConverters,
        );

        const { topicSchemaConverters, unconvertedSubscriptionTopics } = collatedConversions;

        let batchMessages: MessageEvent[] = [];
        let lastBatchTime = performance.now();

        for (;;) {
          // Resolves to undefined immediately on cancel, even mid-read.
          const next = await nextUnlessAborted(rawBatchIterator, signal);
          if (next == undefined || next.done === true) {
            break;
          }
          const iterResult = next.value;

          // Only process "message-event" type results
          if (iterResult.type !== "message-event") {
            continue;
          }

          const msgEvent = iterResult.msgEvent;

          // If the topic is not in unconvertedSubscriptionTopics, skip conversion
          if (unconvertedSubscriptionTopics.has(msgEvent.topic)) {
            batchMessages.push(msgEvent);
          }
          // Apply message conversion if converters exist
          if (topicSchemaConverters.size > 0) {
            convertMessage(msgEvent, topicSchemaConverters, batchMessages, undefined, {
              emitAlert,
            });
          }

          if (performance.now() - lastBatchTime > BATCH_INTERVAL_MS) {
            // Yield the batch if it has been more than 16ms since the last yield
            if (batchMessages.length > 0) {
              // Stale guard: never hand a batch to the consumer after cancel.
              if (isAborted()) {
                break;
              }
              onBatch?.(batchMessages);
              yield batchMessages;
              // New array so consumers can keep references to yielded batches.
              batchMessages = [];
              lastBatchTime = performance.now();
            }
          }
        }

        // Yield any remaining messages if not cancelled
        if (!isAborted() && batchMessages.length > 0) {
          onBatch?.(batchMessages);
          yield batchMessages; // No copy needed - array will be garbage collected
        }
      } catch (err: unknown) {
        if (!isAborted()) {
          log.error("Error in createMessageRangeIterator:", err);
        }
      } finally {
        // Covers cancel, consumer break/return, errors and normal completion (a no-op then).
        closeRawIterator();
      }
    },
  };

  // Return the iterable and a cancel function
  return {
    iterable: messageEventIterable,
    cancel: () => {
      if (cancelledAt != undefined) {
        return;
      }
      cancelledAt = performance.now();
      abortController.abort();
      closeRawIterator();
    },
  };
}
