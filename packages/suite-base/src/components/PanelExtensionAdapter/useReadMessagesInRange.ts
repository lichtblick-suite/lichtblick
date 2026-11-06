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

        const activeReads = activeReadsRef.current;
        activeReads.add(cancel);
        signal?.addEventListener("abort", cancel, { once: true });
        try {
          yield* iterable;
        } finally {
          signal?.removeEventListener("abort", cancel);
          activeReads.delete(cancel);
          cancel();
        }
      }

      return { [Symbol.asyncIterator]: read };
    },
    [getMessagePipelineContext],
  );
}
