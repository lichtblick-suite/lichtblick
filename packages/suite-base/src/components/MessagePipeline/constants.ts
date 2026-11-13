// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Pipeline-level telemetry metric names emitted by the MessagePipeline.
 * Names are stable: downstream benchmark reports key on them.
 */
export const PIPELINE_TELEMETRY_METRICS = {
  /** counter: message events received from the player in a tick with a new `messages` array */
  messagesReceived: "pipeline.messages.received",
  /** counter: sum of `sizeInBytes` of those received message events */
  messagesReceivedBytes: "pipeline.messages.receivedBytes",
  /** counter: message events bucketed to subscribers (fan-out: counted once per subscriber) */
  messagesDelivered: "pipeline.messages.delivered",
  /** counter: sum of `sizeInBytes` of the bucketed message events (fan-out included) */
  messagesDeliveredBytes: "pipeline.messages.deliveredBytes",
  /** gauge: number of distinct subscriber ids */
  subscribersCount: "pipeline.subscribers.count",
  /** gauge: number of subscription payloads across all subscribers */
  subscriptionsCount: "pipeline.subscriptions.count",
  /**
   * observation: duration of the player listener callback (the one registered with
   * `player.setListener()`), from receiving a player state until the promise the player awaits
   * resolves (dispatch + render + pause-frame promises). It is not the time to dispatch to
   * subscribers alone. The sink publishes `.count`, `.sum` and `.max`.
   */
  listenerDispatchDurationMs: "pipeline.listenerDispatchDurationMs",
} as const;
