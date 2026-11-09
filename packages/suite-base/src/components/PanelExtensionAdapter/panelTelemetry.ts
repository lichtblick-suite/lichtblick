// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Immutable, MessageEvent } from "@lichtblick/suite";
import { FALLBACK_PANEL_ID } from "@lichtblick/suite-base/components/constants";
import { ITelemetry, TelemetryLabels } from "@lichtblick/suite-base/util/telemetry";

import { PANEL_TELEMETRY_METRICS } from "./constants";
import { AllFramesDeliveryTracker } from "./panelTelemetry.types";

/**
 * Builds the (frozen) label set identifying a panel. `panelId` is the layout panel id (e.g.
 * `Plot!3x9a`), not the adapter's internal subscriber uuid nor the visible title. Returns undefined
 * for `FALLBACK_PANEL_ID` (panel rendered outside a layout): such panels emit no panel telemetry,
 * like the `panel.mount` event.
 */
export function buildPanelTelemetryLabels(
  panelId: string,
  panelType: string,
): TelemetryLabels | undefined {
  if (panelId === FALLBACK_PANEL_ID) {
    return undefined;
  }
  return Object.freeze({ panelId, panelType });
}

/**
 * Records the number and total size of the message events in a frame handed to the panel's
 * `onRender` (`panel.messages.rendered[Bytes]`). Callers must have checked `telemetry.isEnabled()`.
 * Zero values are not recorded.
 */
export function recordMessagesRendered(
  telemetry: ITelemetry,
  messageEvents: Immutable<readonly MessageEvent[]> | undefined,
  labels: TelemetryLabels,
): void {
  const count = messageEvents?.length ?? 0;
  if (messageEvents == undefined || count === 0) {
    return;
  }
  let bytes = 0;
  for (let i = 0; i < count; i++) {
    bytes += messageEvents[i]!.sizeInBytes;
  }
  telemetry.counter(PANEL_TELEMETRY_METRICS.messagesRendered, count, "count", "panel", labels);
  if (bytes > 0) {
    telemetry.counter(
      PANEL_TELEMETRY_METRICS.messagesRenderedBytes,
      bytes,
      "bytes",
      "panel",
      labels,
    );
  }
}

/**
 * Records one batch of preloaded (range) messages delivered to the panel through
 * `useSubscribeMessageRange` (`panel.rangeMessages.*`). Callers must have checked
 * `telemetry.isEnabled()`. Empty batches are not recorded.
 */
export function recordRangeMessagesDelivered(
  telemetry: ITelemetry,
  batch: readonly MessageEvent[],
  labels: TelemetryLabels,
): void {
  const count = batch.length;
  if (count === 0) {
    return;
  }
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

/** Records a completed panel render. Callers must have checked `telemetry.isEnabled()`. */
export function recordRenderDone(
  telemetry: ITelemetry,
  durationMs: number,
  labels: TelemetryLabels,
): void {
  telemetry.counter(PANEL_TELEMETRY_METRICS.renderCount, 1, "count", "panel", labels);
  telemetry.observe(PANEL_TELEMETRY_METRICS.renderDurationMs, durationMs, "ms", "panel", labels);
}

/** Records the first completed render of an adapter mount. */
export function recordFirstRender(telemetry: ITelemetry, labels: TelemetryLabels): void {
  telemetry.event("panel.firstRender", "instant", "panel", labels);
}

/** Records a frame dropped because the previous render had not called `done()` yet. */
export function recordRenderSkipped(telemetry: ITelemetry, labels: TelemetryLabels): void {
  telemetry.counter(PANEL_TELEMETRY_METRICS.renderSkipped, 1, "count", "panel", labels);
}

export function createAllFramesDeliveryTracker(): AllFramesDeliveryTracker {
  return { lastAllFrames: undefined, countedLength: 0 };
}

/** Forget what was counted, e.g. when the adapter re-initialises its render state builder. */
export function resetAllFramesDeliveryTracker(tracker: AllFramesDeliveryTracker): void {
  tracker.lastAllFrames = undefined;
  tracker.countedLength = 0;
}

/**
 * Counts the preloaded messages delivered to the panel via `renderState.allFrames`
 * (`panel.rangeMessages.*`). Callers must have checked `telemetry.isEnabled()`.
 *
 * - Work is only done when the `allFrames` reference changes (the render state builder keeps
 *   the same array until blocks or conversions change).
 * - The builder rebuilds `allFrames` from all blocks on each block update. During the normal
 *   in-order block load this is append-only, so the new messages are the tail beyond the previously
 *   counted length; only that tail is summed. If new data is merged into the middle (e.g. a newly
 *   preloaded topic), the count is still the exact growth but the bytes are those of the tail
 *   entries, an approximation.
 * - If `allFrames` shrinks or keeps its length (eviction, topic removal, conversion change), the
 *   baseline is reset to the new length and nothing is counted (never negative). Data loaded again
 *   afterwards, or a full rebuild after re-initialisation, is counted again: that is real
 *   re-delivery to the panel.
 */
export function recordAllFramesDelivered(
  telemetry: ITelemetry,
  tracker: AllFramesDeliveryTracker,
  allFrames: Immutable<readonly MessageEvent[]> | undefined,
  labels: TelemetryLabels,
): void {
  if (allFrames === tracker.lastAllFrames) {
    return;
  }
  tracker.lastAllFrames = allFrames;
  const previousLength = tracker.countedLength;
  const length = allFrames?.length ?? 0;
  tracker.countedLength = length;
  if (allFrames == undefined || length <= previousLength) {
    return;
  }
  let bytes = 0;
  for (let i = previousLength; i < length; i++) {
    bytes += allFrames[i]!.sizeInBytes;
  }
  telemetry.counter(
    PANEL_TELEMETRY_METRICS.rangeMessagesDelivered,
    length - previousLength,
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
