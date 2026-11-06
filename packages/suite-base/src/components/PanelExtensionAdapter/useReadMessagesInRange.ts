// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect, useRef } from "react";

import { Immutable, MessageEvent, ReadMessagesInRangeOptions } from "@lichtblick/suite";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import {
  ExtensionCatalog,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";

import { createMessageRangeIterator } from "./messageRangeIterator";
import { MessageConverterAlertHandler } from "./types";

const selectInstalledMessageConverters = (state: ExtensionCatalog) =>
  state.installedMessageConverters;

export type UseReadMessagesInRange = (
  topic: string,
  options?: ReadMessagesInRangeOptions,
) => AsyncIterable<Immutable<MessageEvent[]>>;

/**
 * Returns a stable callback backing `readMessagesInRange`. Each call returns a lazy
 * iterable that reads the requested topic range from the data source on iteration.
 */
export function useReadMessagesInRange(
  emitAlert?: MessageConverterAlertHandler,
): UseReadMessagesInRange {
  const getMessagePipelineContext = useMessagePipelineGetter();

  const messageConverters = useExtensionCatalog(selectInstalledMessageConverters);
  const messageConvertersRef = useRef(messageConverters);
  messageConvertersRef.current = messageConverters;

  const emitAlertRef = useRef(emitAlert);
  emitAlertRef.current = emitAlert;

  // In-flight reads are cancelled on unmount so abandoned reads don't keep the source busy.
  const activeReadsRef = useRef(new Set<() => void>());
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    const activeReads = activeReadsRef.current;
    return () => {
      unmountedRef.current = true;
      for (const cancel of activeReads) {
        cancel();
      }
      activeReads.clear();
    };
  }, []);

  return useCallback(
    (topic: string, options: ReadMessagesInRangeOptions = {}) => {
      const { start, end, convertTo, signal } = options;

      async function* read(): AsyncGenerator<Immutable<MessageEvent[]>> {
        if (signal?.aborted === true || unmountedRef.current) {
          return;
        }

        const { sortedTopics, getBatchIterator } = getMessagePipelineContext();
        // Pass undefined for unbounded reads so players can reuse their full-range caches.
        const range = start != undefined || end != undefined ? { start, end } : undefined;
        const rawBatchIterator = getBatchIterator(topic, range);
        if (!rawBatchIterator) {
          return;
        }

        const { iterable, cancel } = createMessageRangeIterator({
          topic,
          convertTo,
          rawBatchIterator,
          sortedTopics,
          messageConverters: messageConvertersRef.current ?? [],
          emitAlert: emitAlertRef.current,
          rethrowErrors: true,
        });

        let stop!: () => void;
        const stopped = new Promise<IteratorReturnResult<undefined>>((resolve) => {
          stop = () => {
            cancel();
            resolve({ done: true, value: undefined });
          };
        });
        const iterator = iterable[Symbol.asyncIterator]();

        const activeReads = activeReadsRef.current;
        activeReads.add(stop);
        signal?.addEventListener("abort", stop, { once: true });
        try {
          for (;;) {
            // Racing lets abort/unmount settle the consumer even while a source read is in flight.
            const result = await Promise.race([iterator.next(), stopped]);
            if (result.done === true) {
              return;
            }
            yield result.value;
          }
        } finally {
          signal?.removeEventListener("abort", stop);
          activeReads.delete(stop);
          stop();
          void iterator.return?.();
        }
      }

      return { [Symbol.asyncIterator]: read };
    },
    [getMessagePipelineContext],
  );
}
