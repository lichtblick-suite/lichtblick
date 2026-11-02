// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useContext, useEffect } from "react";

import { MessageEvent } from "@lichtblick/suite";
import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { getTelemetry, ITelemetry, TelemetryLabels } from "@lichtblick/suite-base/util/telemetry";

import { PIPELINE_TELEMETRY_METRICS } from "./constants";
import { MessagePipelineInternalState } from "./store";
import { PANEL_TELEMETRY_METRICS } from "../PanelExtensionAdapter/panelTelemetry";

/**
 * Panel labels (`panelId` = layout id, `panelType`) of pipeline subscribers that live inside a
 * built-in React panel. Only populated while telemetry is enabled (see
 * `usePanelSubscriberTelemetry`). Extension panels are counted by `PanelExtensionAdapter` and do
 * not register here.
 */
const panelLabelsBySubscriberId = new Map<string, TelemetryLabels>();

export function registerSubscriberPanelLabels(subscriberId: string, labels: TelemetryLabels): void {
  panelLabelsBySubscriberId.set(subscriberId, labels);
}

export function unregisterSubscriberPanelLabels(subscriberId: string): void {
  panelLabelsBySubscriberId.delete(subscriberId);
}

/**
 * Attributes the messages the pipeline delivers to `subscriberId` to the enclosing panel, so
 * built-in panels get `panel.messages.delivered[Bytes]` counters. No-op outside a panel or when
 * telemetry is disabled (checked when the effect runs).
 */
export function usePanelSubscriberTelemetry(subscriberId: string): void {
  // Optional on purpose: usePanelContext() throws outside a panel.
  const panelContext = useContext(PanelContext);
  const panelId = panelContext?.id;
  const panelType = panelContext?.type;

  useEffect(() => {
    if (panelId == undefined || panelType == undefined || !getTelemetry().isEnabled()) {
      return;
    }
    registerSubscriberPanelLabels(subscriberId, Object.freeze({ panelId, panelType }));
    return () => {
      unregisterSubscriberPanelLabels(subscriberId);
    };
  }, [subscriberId, panelId, panelType]);
}

/**
 * Records the per-tick pipeline telemetry: messages received from the player, messages
 * delivered to subscribers after bucketing (fan-out), per-panel delivered counters for subscribers
 * registered via `usePanelSubscriberTelemetry`, and the subscriber / subscription gauges.
 *
 * Call once per player listener tick, right after the "update-player-state" dispatch, and only
 * when `telemetry.isEnabled()` is true. `state.public.messageEventsBySubscriberId` then holds
 * exactly the bucketing result of this tick, so the reducer's hot path stays untouched.
 *
 * `previousMessages` is the `activeData.messages` held by the store *before* this tick's dispatch.
 * The reducer only buckets messages when the array reference changes, so when the player re-emits
 * the same array the message counters (received and delivered) are skipped for the tick; the
 * gauges are still reported.
 */
export function recordPipelineTickTelemetry(
  telemetry: ITelemetry,
  state: MessagePipelineInternalState,
  receivedMessages: readonly MessageEvent[] | undefined,
  previousMessages?: readonly MessageEvent[],
): void {
  // Mirrors updatePlayerStateAction: same reference => nothing was bucketed this tick.
  if (receivedMessages == undefined || receivedMessages !== previousMessages) {
    recordMessageCounters(telemetry, state, receivedMessages);
  }

  let subscriptionCount = 0;
  for (const payloads of state.subscriptionsById.values()) {
    subscriptionCount += payloads.length;
  }
  telemetry.gauge(
    PIPELINE_TELEMETRY_METRICS.subscribersCount,
    state.subscriptionsById.size,
    "count",
    "pipeline",
  );
  telemetry.gauge(
    PIPELINE_TELEMETRY_METRICS.subscriptionsCount,
    subscriptionCount,
    "count",
    "pipeline",
  );
}

function recordMessageCounters(
  telemetry: ITelemetry,
  state: MessagePipelineInternalState,
  receivedMessages: readonly MessageEvent[] | undefined,
): void {
  if (receivedMessages != undefined && receivedMessages.length > 0) {
    let receivedBytes = 0;
    for (const messageEvent of receivedMessages) {
      receivedBytes += messageEvent.sizeInBytes;
    }
    telemetry.counter(
      PIPELINE_TELEMETRY_METRICS.messagesReceived,
      receivedMessages.length,
      "count",
      "pipeline",
    );
    telemetry.counter(
      PIPELINE_TELEMETRY_METRICS.messagesReceivedBytes,
      receivedBytes,
      "bytes",
      "pipeline",
    );
  }

  let deliveredCount = 0;
  let deliveredBytes = 0;
  for (const [subscriberId, events] of state.public.messageEventsBySubscriberId) {
    if (events.length === 0) {
      continue;
    }
    let subscriberBytes = 0;
    for (const messageEvent of events) {
      subscriberBytes += messageEvent.sizeInBytes;
    }
    deliveredCount += events.length;
    deliveredBytes += subscriberBytes;

    const panelLabels = panelLabelsBySubscriberId.get(subscriberId);
    if (panelLabels != undefined) {
      /*
       * `panel.messages.delivered[Bytes]` for built-in panels (subscribers registered through
       * `usePanelSubscriberTelemetry`): the messages bucketed to the panel's subscribers in this
       * pipeline tick, emitted once per subscriber id (so the panel total is the sum across its
       * subscriber ids), whether or not the panel rendered them. Extension-API panels emit the
       * same metric from PanelExtensionAdapter, but only for frames they actually rendered.
       */
      telemetry.counter(
        PANEL_TELEMETRY_METRICS.messagesDelivered,
        events.length,
        "count",
        "panel",
        panelLabels,
      );
      telemetry.counter(
        PANEL_TELEMETRY_METRICS.messagesDeliveredBytes,
        subscriberBytes,
        "bytes",
        "panel",
        panelLabels,
      );
    }
  }
  if (deliveredCount > 0) {
    telemetry.counter(
      PIPELINE_TELEMETRY_METRICS.messagesDelivered,
      deliveredCount,
      "count",
      "pipeline",
    );
    telemetry.counter(
      PIPELINE_TELEMETRY_METRICS.messagesDeliveredBytes,
      deliveredBytes,
      "bytes",
      "pipeline",
    );
  }
}
