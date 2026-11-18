// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useContext, useEffect, useMemo, useRef } from "react";

import Logger from "@lichtblick/log";
import { compare } from "@lichtblick/rostime";
import { MessageEvent, SubscribeMessageRangeArgs } from "@lichtblick/suite";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import {
  ExtensionCatalog,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { getTelemetry } from "@lichtblick/suite-base/util/telemetry";

import { createMessageRangeIterator } from "./messageRangeIterator";
import {
  buildPanelTelemetryLabels,
  recordRangeCancelQuiescence,
  recordRangeMessagesDelivered,
} from "./panelTelemetry";
import { MessageConverterAlertHandler } from "./types";

const log = Logger.getLogger(__filename);

const selectInstalledMessageConverters = (state: ExtensionCatalog) =>
  state.installedMessageConverters;

export type UseSubscribeMessageRange = (args: SubscribeMessageRangeArgs) => () => void;

/**
 * The range subscriptions opened by one hook instance for one data source (`playerId`). A
 * generation ends when the data source changes (new source, source closed) or the hook unmounts
 * (layout switch, panel removed); every subscription still open is then cancelled, so no batch from
 * an old generation can reach the panel even if the caller never calls cancel itself.
 */
type RangeSubscriptionGeneration = {
  playerId: string | undefined;
  cancels: Set<() => void>;
};

function endGeneration(generation: RangeSubscriptionGeneration): void {
  const cancels = [...generation.cancels];
  generation.cancels.clear();
  for (const cancel of cancels) {
    cancel();
  }
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

  // Never replace .current: the unmount cleanup below holds on to this object.
  const generationRef = useRef<RangeSubscriptionGeneration>({
    playerId: undefined,
    cancels: new Set<() => void>(),
  });
  useEffect(() => {
    const generation = generationRef.current;
    return () => {
      endGeneration(generation);
    };
  }, []);

  return useCallback(
    ({ topic, start, end, convertTo, onNewRangeIterator }: SubscribeMessageRangeArgs) => {
      if (start != undefined && end != undefined && compare(start, end) > 0) {
        onNewRangeIterator((async function* () {})()).catch((err: unknown) => {
          log.error("Error in useSubscribeMessageRange onNewRangeIterator:", err);
        });
        return () => {};
      }

      const { sortedTopics, getBatchIterator, playerState } = getMessagePipelineContext();

      // A new data source starts a new generation: terminate everything left from the old one.
      // An empty id is the initializing (or closed) player, so "" -> id is not a new generation.
      const generation = generationRef.current;
      const playerId = playerState.playerId;
      if (playerId !== "" && playerId !== generation.playerId) {
        if (generation.playerId != undefined) {
          endGeneration(generation);
        }
        generation.playerId = playerId;
      }

      // The signal reaches the worker cursor, so cancel() also stops an in-flight read there.
      // Without start/end, players can still reuse their full-range caches.
      const abortController = new AbortController();
      const rawBatchIterator = getBatchIterator(topic, {
        start,
        end,
        abort: abortController.signal,
      });
      if (!rawBatchIterator) {
        return () => {};
      }

      // When telemetry is disabled no batch callback is installed.
      const telemetry = getTelemetry();
      const labels = telemetryLabelsRef.current;
      const telemetryEnabled = labels != undefined && telemetry.isEnabled();
      const onBatch = telemetryEnabled
        ? (batch: readonly MessageEvent[]) => {
            recordRangeMessagesDelivered(telemetry, batch, labels);
          }
        : undefined;
      const onQuiescent = telemetryEnabled
        ? (durationMs: number) => {
            recordRangeCancelQuiescence(telemetry, durationMs, labels);
          }
        : undefined;

      const { iterable, cancel } = createMessageRangeIterator({
        topic,
        convertTo,
        rawBatchIterator,
        sortedTopics,
        messageConverters: messageConvertersRef.current ?? [],
        emitAlert: emitAlertRef.current,
        onBatch,
        abortController,
        onQuiescent,
      });

      const cancelSubscription = () => {
        generation.cancels.delete(cancelSubscription);
        cancel();
      };
      generation.cancels.add(cancelSubscription);

      onNewRangeIterator(iterable)
        .catch((err: unknown) => {
          log.error("Error in useSubscribeMessageRange onNewRangeIterator:", err);
        })
        .finally(() => {
          // Fully consumed: nothing left to cancel when the generation ends.
          generation.cancels.delete(cancelSubscription);
        });

      return cancelSubscription;
    },
    [getMessagePipelineContext], // getMessagePipelineContext is already stable, but listed for clarity
  );
}
