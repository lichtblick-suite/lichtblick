// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent } from "@lichtblick/suite";
import { FALLBACK_PANEL_ID } from "@lichtblick/suite-base/components/constants";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";

import { PANEL_TELEMETRY_METRICS } from "./constants";
import {
  buildPanelTelemetryLabels,
  createPanelFrameTelemetryState,
  recordFirstRender,
  recordFrameRendering,
  recordFrameSkipped,
  recordMessagesRendered,
  recordRangeMessagesDelivered,
  recordRenderDone,
  recordRenderSkipped,
  resetPanelFrameTelemetryState,
} from "./panelTelemetry";

function buildMessage(sizeInBytes: number): MessageEvent {
  return {
    topic: "/x",
    receiveTime: { sec: 0, nsec: 0 },
    sizeInBytes,
    message: {},
    schemaName: "foo",
  };
}

const LABELS = buildPanelTelemetryLabels("Plot!3x9a", "Plot")!;

function counterValues(
  telemetry: ReturnType<typeof TelemetryBuilder.mockTelemetry>,
  metric: string,
): unknown[] {
  return telemetry.counter.mock.calls.filter(([name]) => name === metric).map(([, value]) => value);
}

describe("panelTelemetry", () => {
  it("builds labels from the layout panel id and panel type", () => {
    // GIVEN / WHEN
    const labels = buildPanelTelemetryLabels("Plot!3x9a", "Plot");

    // THEN
    expect(labels).toEqual({ panelId: "Plot!3x9a", panelType: "Plot" });
    expect(Object.isFrozen(labels)).toBe(true);
  });

  it("should build no labels for a panel rendered outside a layout", () => {
    // GIVEN / WHEN
    const labels = buildPanelTelemetryLabels(FALLBACK_PANEL_ID, "Plot");

    // THEN
    expect(labels).toBeUndefined();
  });

  it("records message count and summed bytes for a frame", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();

    // WHEN
    recordMessagesRendered(telemetry, [buildMessage(5), buildMessage(7)], LABELS);

    // THEN
    expect(telemetry.counter.mock.calls).toEqual([
      [PANEL_TELEMETRY_METRICS.messagesRendered, 2, "count", "panel", LABELS],
      [PANEL_TELEMETRY_METRICS.messagesRenderedBytes, 12, "bytes", "panel", LABELS],
    ]);
  });

  it.each([undefined, []])("skips empty frames (%p)", (messageEvents) => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();

    // WHEN
    recordMessagesRendered(telemetry, messageEvents, LABELS);

    // THEN
    expect(telemetry.counter.mock.calls).toHaveLength(0);
  });

  it("skips the bytes counter when all message sizes are zero", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();

    // WHEN
    recordMessagesRendered(telemetry, [buildMessage(0)], LABELS);

    // THEN
    expect(telemetry.counter.mock.calls).toEqual([
      [PANEL_TELEMETRY_METRICS.messagesRendered, 1, "count", "panel", LABELS],
    ]);
  });

  it("records range message count and summed bytes for a batch", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();

    // WHEN
    recordRangeMessagesDelivered(telemetry, [buildMessage(5), buildMessage(7)], LABELS);
    recordRangeMessagesDelivered(telemetry, [], LABELS);
    recordRangeMessagesDelivered(telemetry, [buildMessage(0)], LABELS);

    // THEN - empty batches and zero byte totals are not recorded
    expect(telemetry.counter.mock.calls).toEqual([
      [PANEL_TELEMETRY_METRICS.rangeMessagesDelivered, 2, "count", "panel", LABELS],
      [PANEL_TELEMETRY_METRICS.rangeMessagesDeliveredBytes, 12, "bytes", "panel", LABELS],
      [PANEL_TELEMETRY_METRICS.rangeMessagesDelivered, 1, "count", "panel", LABELS],
    ]);
  });

  it("records render count and duration for each completed render", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();

    // WHEN
    recordRenderDone(telemetry, 3.5, LABELS);
    recordRenderDone(telemetry, 1.25, LABELS);

    // THEN
    expect(telemetry.counter.mock.calls).toEqual([
      [PANEL_TELEMETRY_METRICS.renderCount, 1, "count", "panel", LABELS],
      [PANEL_TELEMETRY_METRICS.renderCount, 1, "count", "panel", LABELS],
    ]);
    expect(telemetry.gauge.mock.calls).toHaveLength(0);
    expect(telemetry.observe.mock.calls).toEqual([
      [PANEL_TELEMETRY_METRICS.renderDurationMs, 3.5, "ms", "panel", LABELS],
      [PANEL_TELEMETRY_METRICS.renderDurationMs, 1.25, "ms", "panel", LABELS],
    ]);
    expect(telemetry.event.mock.calls).toHaveLength(0);
  });

  it("records the firstRender event", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();

    // WHEN
    recordFirstRender(telemetry, LABELS);

    // THEN
    expect(telemetry.event.mock.calls).toEqual([["panel.firstRender", "instant", "panel", LABELS]]);
  });

  it("records a skipped render", () => {
    // GIVEN
    const telemetry = TelemetryBuilder.mockTelemetry();

    // WHEN
    recordRenderSkipped(telemetry, LABELS);

    // THEN
    expect(telemetry.counter.mock.calls).toEqual([
      [PANEL_TELEMETRY_METRICS.renderSkipped, 1, "count", "panel", LABELS],
    ]);
  });

  describe("frame accounting", () => {
    const CURRENT_FRAME = new Set(["currentFrame"]);
    const ALL_FRAMES = new Set(["allFrames"]);
    const NOTHING_WATCHED = new Set<string>();

    it("should count a new frame as skipped once and ignore an empty or already accounted frame", () => {
      // GIVEN
      const telemetry = TelemetryBuilder.mockTelemetry();
      const state = createPanelFrameTelemetryState();
      const frame = [buildMessage(5)];

      // WHEN
      recordFrameSkipped(telemetry, state, frame, LABELS);
      recordFrameSkipped(telemetry, state, frame, LABELS);
      recordFrameSkipped(telemetry, state, undefined, LABELS);

      // THEN
      expect(telemetry.counter.mock.calls).toEqual([
        [PANEL_TELEMETRY_METRICS.renderSkipped, 1, "count", "panel", LABELS],
      ]);
      expect(state.lastAccountedFrame).toBe(frame);
    });

    it("should not count a frame accounted by a render as skipped afterwards", () => {
      // GIVEN
      const telemetry = TelemetryBuilder.mockTelemetry();
      const state = createPanelFrameTelemetryState();
      const frame = [buildMessage(5)];
      recordFrameRendering(telemetry, state, frame, undefined, NOTHING_WATCHED, LABELS);

      // WHEN
      recordFrameSkipped(telemetry, state, frame, LABELS);

      // THEN
      expect(telemetry.counter).not.toHaveBeenCalled();
    });

    it("should count a rendered frame once while currentFrame is watched", () => {
      // GIVEN
      const telemetry = TelemetryBuilder.mockTelemetry();
      const state = createPanelFrameTelemetryState();
      const frame = [buildMessage(5), buildMessage(7)];

      // WHEN
      recordFrameRendering(telemetry, state, frame, undefined, CURRENT_FRAME, LABELS);
      recordFrameRendering(telemetry, state, frame, undefined, CURRENT_FRAME, LABELS);

      // THEN
      expect(telemetry.counter.mock.calls).toEqual([
        [PANEL_TELEMETRY_METRICS.messagesRendered, 2, "count", "panel", LABELS],
        [PANEL_TELEMETRY_METRICS.messagesRenderedBytes, 12, "bytes", "panel", LABELS],
      ]);
    });

    it("should count a frame rendered while currentFrame was unwatched once it is watched", () => {
      // GIVEN - a frame first rendered while currentFrame is not watched
      const telemetry = TelemetryBuilder.mockTelemetry();
      const state = createPanelFrameTelemetryState();
      const frame = [buildMessage(5)];
      recordFrameRendering(telemetry, state, frame, undefined, NOTHING_WATCHED, LABELS);
      expect(telemetry.counter).not.toHaveBeenCalled();

      // WHEN - the same frame is rendered after the panel starts watching currentFrame
      recordFrameRendering(telemetry, state, frame, undefined, CURRENT_FRAME, LABELS);

      // THEN
      expect(telemetry.counter.mock.calls).toEqual([
        [PANEL_TELEMETRY_METRICS.messagesRendered, 1, "count", "panel", LABELS],
        [PANEL_TELEMETRY_METRICS.messagesRenderedBytes, 5, "bytes", "panel", LABELS],
      ]);
      expect(state.lastRenderedFrame).toBe(frame);
    });

    it("should count new allFrames entries only while allFrames is watched", () => {
      // GIVEN
      const telemetry = TelemetryBuilder.mockTelemetry();
      const state = createPanelFrameTelemetryState();
      const allFrames = [buildMessage(3), buildMessage(4)];

      // WHEN
      recordFrameRendering(telemetry, state, undefined, allFrames, NOTHING_WATCHED, LABELS);
      recordFrameRendering(telemetry, state, undefined, allFrames, ALL_FRAMES, LABELS);

      // THEN
      expect(telemetry.counter.mock.calls).toEqual([
        [PANEL_TELEMETRY_METRICS.rangeMessagesDelivered, 2, "count", "panel", LABELS],
        [PANEL_TELEMETRY_METRICS.rangeMessagesDeliveredBytes, 7, "bytes", "panel", LABELS],
      ]);
    });

    it("should count the same frame again after a reset", () => {
      // GIVEN
      const telemetry = TelemetryBuilder.mockTelemetry();
      const state = createPanelFrameTelemetryState();
      const frame = [buildMessage(5)];
      const allFrames = [buildMessage(3)];
      const watched = new Set(["currentFrame", "allFrames"]);
      recordFrameRendering(telemetry, state, frame, allFrames, watched, LABELS);

      // WHEN
      resetPanelFrameTelemetryState(state);
      recordFrameRendering(telemetry, state, frame, allFrames, watched, LABELS);

      // THEN
      expect(counterValues(telemetry, PANEL_TELEMETRY_METRICS.messagesRendered)).toEqual([1, 1]);
      expect(counterValues(telemetry, PANEL_TELEMETRY_METRICS.rangeMessagesDelivered)).toEqual([
        1, 1,
      ]);
    });
  });
});
