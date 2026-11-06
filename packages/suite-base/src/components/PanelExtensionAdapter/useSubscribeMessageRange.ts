// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useContext, useMemo, useRef } from "react";

import Logger from "@lichtblick/log";
import { Immutable, MessageEvent, SubscribeMessageRangeArgs } from "@lichtblick/suite";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import {
  ExtensionCatalog,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { getTelemetry, ITelemetry, TelemetryLabels } from "@lichtblick/suite-base/util/telemetry";

import { createMessageRangeIterator } from "./messageRangeIterator";
import { buildPanelTelemetryLabels, PANEL_TELEMETRY_METRICS } from "./panelTelemetry";
import { MessageConverterAlertHandler } from "./types";

const log = Logger.getLogger(__filename);

const selectInstalledMessageConverters = (state: ExtensionCatalog) =>
  state.installedMessageConverters;

export type UseSubscribeMessageRange = (args: SubscribeMessageRangeArgs) => () => void;

/**
 * Wraps a range iterable so that each yielded batch is counted (messages and bytes) under
 * `panel.rangeMessages.*`, aggregated per yielded batch. Batches are
 * forwarded unchanged; early termination by the consumer propagates to the source iterator.
 * Only used when telemetry is enabled.
 */
function withRangeTelemetry(
  source: AsyncIterable<Immutable<MessageEvent[]>>,
  telemetry: ITelemetry,
  labels: TelemetryLabels,
): AsyncIterable<Immutable<MessageEvent[]>> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const batch of source) {
        const count = batch.length;
        if (count > 0) {
          let bytes = 0;
          for (let i = 0; i < count; i++) {
            bytes += batch[i]!.sizeInBytes;
          }
          telemetry.counter(
            PANEL_TELEMETRY_METRICS.rangeMessagesDelivered,
            count,
            "count",
            "panel",
            labels,
          );
          if (bytes > 0) {
            telemetry.counter(
              PANEL_TELEMETRY_METRICS.rangeMessagesDeliveredBytes,
              bytes,
              "bytes",
              "panel",
              labels,
            );
          }
        }
        yield batch;
      }
    },
  };
}

/**
 * Returns a stable callback that can be used to subscribe to a message range for a topic.
 * This centralizes the logic of `unstable_subscribeMessageRange` so it can be used both by
 * PanelExtensionAdapter and directly by built-in panels (e.g. Plot) without requiring migration
 * to the PanelExtensionContext API.
 */
export function useSubscribeMessageRange(
  emitAlert?: MessageConverterAlertHandler,
): UseSubscribeMessageRange {
  // useMessagePipelineGetter returns a stable getter, so it's safe to call it inside the callback without adding it to dependencies.
  const getMessagePipelineContext = useMessagePipelineGetter();

  // Keep messageConverters in a ref so changing converters don't invalidate the callback.
  const messageConverters = useExtensionCatalog(selectInstalledMessageConverters);
  const messageConvertersRef = useRef(messageConverters);
  messageConvertersRef.current = messageConverters;

  // Similarly keep emitAlert in a ref so the caller can update it without breaking stability.
  const emitAlertRef = useRef(emitAlert);
  emitAlertRef.current = emitAlert;

  // The panel context is optional: this hook may be used outside a panel (no telemetry labels).
  // Labels use the layout panel id (e.g. `Plot!3x9a`) and are kept in a ref so the callback stays stable.
  const panelContext = useContext(PanelContext);
  const layoutPanelId = panelContext?.id;
  const panelType = panelContext?.type;
  const telemetryLabels = useMemo(
    () =>
      layoutPanelId != undefined && panelType != undefined
        ? buildPanelTelemetryLabels(layoutPanelId, panelType)
        : undefined,
    [layoutPanelId, panelType],
  );
  const telemetryLabelsRef = useRef(telemetryLabels);
  telemetryLabelsRef.current = telemetryLabels;

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

      // When telemetry is disabled the original iterable is passed through untouched.
      const telemetry = getTelemetry();
      const labels = telemetryLabelsRef.current;
      const iterable =
        labels != undefined && telemetry.isEnabled()
          ? withRangeTelemetry(messageEventIterable, telemetry, labels)
          : messageEventIterable;

      onNewRangeIterator(iterable).catch((err: unknown) => {
        log.error("Error in useSubscribeMessageRange onNewRangeIterator:", err);
      });

      return cancel;
    },
    [getMessagePipelineContext], // getMessagePipelineContext is already stable, but listed for clarity
  );
}
