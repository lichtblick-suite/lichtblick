// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This is the target interval for batching messages. It is set to 16ms to align with a 60Hz update rate.
export const BATCH_INTERVAL_MS = 16;

/**
 * Per-panel telemetry metric names. Names are stable: downstream benchmark reports key
 * on them. Re-exported from `./panelTelemetry`, which is the import path for consumers.
 *
 * What `panel.messages.delivered` counts depends on the panel kind:
 * - Extension-API panels (PanelExtensionAdapter): messages in the frames actually rendered, i.e.
 *   the `currentFrame` handed to `onRender`. Frames skipped because the previous render was still
 *   pending are not counted (they are counted in `panel.render.skipped` instead).
 * - Built-in panels (PanelAPI hooks): counted by the MessagePipeline, as the messages bucketed
 *   for the panel's subscriber on each tick.
 *
 * `panel.rangeMessages.*` counts preloaded (range) deliveries: the batches yielded by
 * `useSubscribeMessageRange`, plus the new tail of `renderState.allFrames`.
 */
export const PANEL_TELEMETRY_METRICS = {
  /** counter: message events delivered to the panel, aggregated per frame (see above) */
  messagesDelivered: "panel.messages.delivered",
  /** counter: sum of `sizeInBytes` of the message events counted in `messagesDelivered` */
  messagesDeliveredBytes: "panel.messages.deliveredBytes",
  /** counter: completed renders (panel called `done()`) */
  renderCount: "panel.render.count",
  /**
   * observation: time from invoking the panel's onRender until it called `done()`. The sink
   * publishes `.count`, `.sum` and `.max` per window.
   */
  renderDurationMs: "panel.render.durationMs",
  /**
   * counter: new frames (new `currentFrame` input) that could not be rendered because the previous
   * render was still pending. Re-runs caused by other inputs (hover, variables, theme...) are not
   * counted.
   */
  renderSkipped: "panel.render.skipped",
  /**
   * counter: preloaded (range) message events delivered to the panel, either through
   * `useSubscribeMessageRange` batches or through new entries in `renderState.allFrames`
   */
  rangeMessagesDelivered: "panel.rangeMessages.delivered",
  /** counter: sum of `sizeInBytes` of those preloaded message events */
  rangeMessagesDeliveredBytes: "panel.rangeMessages.deliveredBytes",
} as const;
