// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@lichtblick/log";
import { MessageEvent, Subscription } from "@lichtblick/suite";
import { CreateMessageRangeIteratorParams } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { BATCH_INTERVAL_MS } from "@lichtblick/suite-base/components/PanelExtensionAdapter/contants";

const log = Logger.getLogger(__filename);

/**
 * Creates an async iterable that processes messages from a raw batch iterator,
 * applying conversions and batching as needed.
 */
export function createMessageRangeIterator(params: CreateMessageRangeIteratorParams): {
  iterable: AsyncIterable<MessageEvent[]>;
  cancel: () => void;
} {
  const { topic, convertTo, rawBatchIterator, sortedTopics, messageConverters } = params;

  // Create a cancellation token
  let cancelled = false;

  // Create a wrapper async iterable that converts IteratorResult to MessageEvent
  const messageEventIterable = {
    async *[Symbol.asyncIterator]() {
      try {
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

        const batchMessages: MessageEvent[] = [];
        let lastBatchTime = performance.now();

        for await (const iterResult of rawBatchIterator) {
          // Check if cancelled before processing each iteration
          if (cancelled) {
            break;
          }

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
            convertMessage(msgEvent, topicSchemaConverters, batchMessages);
          }

          if (performance.now() - lastBatchTime > BATCH_INTERVAL_MS) {
            // Yield the batch if it has been more than 16ms since the last yield
            if (batchMessages.length > 0) {
              yield batchMessages; // No copy needed - we clear it immediately after
              batchMessages.length = 0; // Clear the batch
              lastBatchTime = performance.now();
            }
          }
        }

        // Yield any remaining messages if not cancelled
        if (!cancelled && batchMessages.length > 0) {
          yield batchMessages; // No copy needed - array will be garbage collected
        }
      } catch (err: unknown) {
        if (!cancelled) {
          log.error("Error in createMessageRangeIterator:", err);
        }
      }
    },
  };

  // Return the iterable and a cancel function
  return {
    iterable: messageEventIterable,
    cancel: () => {
      cancelled = true;
    },
  };
}
