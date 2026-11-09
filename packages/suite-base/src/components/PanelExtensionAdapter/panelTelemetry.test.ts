// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent } from "@lichtblick/suite";
import { FALLBACK_PANEL_ID } from "@lichtblick/suite-base/components/constants";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";

import { PANEL_TELEMETRY_METRICS } from "./constants";
import {
  buildPanelTelemetryLabels,
  recordFirstRender,
  recordMessagesRendered,
  recordRangeMessagesDelivered,
  recordRenderDone,
  recordRenderSkipped,
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
});
