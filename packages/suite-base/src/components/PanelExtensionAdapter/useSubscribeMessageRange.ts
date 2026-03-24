// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useRef } from "react";

import Logger from "@lichtblick/log";
import { SubscribeMessageRangeArgs } from "@lichtblick/suite";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import {
  ExtensionCatalog,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";

import { createMessageRangeIterator } from "./messageRangeIterator";
import { MessageConverterAlertHandler } from "./types";

const log = Logger.getLogger(__filename);

const selectInstalledMessageConverters = (state: ExtensionCatalog) =>
  state.installedMessageConverters;

export type UseSubscribeMessageRange = (args: SubscribeMessageRangeArgs) => () => void;

/**
 * Returns a stable callback that can be used to subscribe to a message range for a topic.
 * This centralizes the logic of `unstable_subscribeMessageRange` so it can be used both by
 * PanelExtensionAdapter and directly by built-in panels (e.g. Plot) without requiring migration
 * to the PanelExtensionContext API.
 */
export function useSubscribeMessageRange(
  emitAlert?: MessageConverterAlertHandler,
): UseSubscribeMessageRange {
  // useMessagePipelineGetter returns a stable getter — calling it does not subscribe to changes.
  const getMessagePipelineContext = useMessagePipelineGetter();

  // Keep messageConverters in a ref so changing converters don't invalidate the callback.
  const messageConverters = useExtensionCatalog(selectInstalledMessageConverters);
  const messageConvertersRef = useRef(messageConverters);
  messageConvertersRef.current = messageConverters;

  // Similarly keep emitAlert in a ref so the caller can update it without breaking stability.
  const emitAlertRef = useRef(emitAlert);
  emitAlertRef.current = emitAlert;

  return useCallback(
    ({ topic, convertTo, onNewRangeIterator }: SubscribeMessageRangeArgs) => {
      const { sortedTopics, getBatchIterator } = getMessagePipelineContext();

      const rawBatchIterator = getBatchIterator(topic);
      if (!rawBatchIterator) {
        return () => {};
      }

      const { iterable: messageEventIterable, cancel } = createMessageRangeIterator({
        topic,
        convertTo,
        rawBatchIterator,
        sortedTopics,
        messageConverters: messageConvertersRef.current ?? [],
        emitAlert: emitAlertRef.current,
      });

      onNewRangeIterator(messageEventIterable).catch((err: unknown) => {
        log.error("Error in useSubscribeMessageRange onNewRangeIterator:", err);
      });

      return cancel;
    },
    [getMessagePipelineContext], // getMessagePipelineContext is already stable, but listed for clarity
  );
}
