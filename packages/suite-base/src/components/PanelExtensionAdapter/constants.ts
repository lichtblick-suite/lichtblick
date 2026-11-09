// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This is the target interval for batching messages. It is set to 16ms to align with a 60Hz update rate.
export const BATCH_INTERVAL_MS = 16;

/**
 * Per-panel telemetry metric names. Names are stable: downstream benchmark reports key
 * on them. Kept in this dependency-free module so the MessagePipeline and the benchmark harness can
 * import them without pulling in adapter code.
 *
 * `panel.messages.delivered` has one meaning for every panel: the messages the MessagePipeline
 * bucketed for the panel's subscribers on each tick, whether or not the panel rendered them.
 * `panel.messages.rendered` is only emitted by extension-API panels (PanelExtensionAdapter): the
 * messages in the `currentFrame` actually handed to `onRender`. `delivered - rendered` is the
 * number of messages the panel could not keep up with.
 *
 * `panel.rangeMessages.*` counts preloaded (range) deliveries: the batches yielded by
 * `useSubscribeMessageRange`, plus the new tail of `renderState.allFrames`.
 */
export const PANEL_TELEMETRY_METRICS = {
  /** counter: message events bucketed by the pipeline for the panel's subscribers (see above) */
  messagesDelivered: "panel.messages.delivered",
  /** counter: sum of `sizeInBytes` of the message events counted in `messagesDelivered` */
  messagesDeliveredBytes: "panel.messages.deliveredBytes",
  /**
   * counter: message events in the frames handed to an extension panel's `onRender` (see above),
   * counted once per frame, including a skipped frame that is rendered later
   */
  messagesRendered: "panel.messages.rendered",
  /** counter: sum of `sizeInBytes` of the message events counted in `messagesRendered` */
  messagesRenderedBytes: "panel.messages.renderedBytes",
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
  /**
   * counter: sum of `sizeInBytes` of those preloaded message events. Approximate for `allFrames`:
   * when new data is merged into the middle of `allFrames` only the appended tail is summed
   * (re-summing the whole array on every block update is too expensive). The count is exact.
   */
  rangeMessagesDeliveredBytes: "panel.rangeMessages.deliveredBytes",
} as const;
