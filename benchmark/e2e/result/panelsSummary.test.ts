// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TelemetryRecordBuilder, panelLabels } from "./builders/TelemetryRecordBuilder";
import { PANEL_METRICS } from "./constants";
import { summarizePanels, summarizePanelsReady } from "./panelsSummary";

const ORIGIN = 1000;
const PLOT = "Plot!a";
const THREE_D = "3D!b";

function panelCounter(
  metric: string,
  panelId: string,
  points: ReadonlyArray<readonly [number, number]>,
) {
  return TelemetryRecordBuilder.counterSeries(metric, points, {
    scope: "panel",
    labels: panelLabels(panelId),
  });
}

function panelObservations(
  metric: string,
  panelId: string,
  windows: ReadonlyArray<readonly [number, number, number, number]>,
) {
  return TelemetryRecordBuilder.observationSeries(metric, windows, {
    scope: "panel",
    labels: panelLabels(panelId),
  });
}

describe("summarizePanels", () => {
  it("should summarize a React panel (no firstRender, no render metrics) from counter totals", () => {
    // Given a Plot panel with current-frame and range counters (cumulative, 1 Hz)
    const samples = [
      ...panelCounter(PANEL_METRICS.messagesDelivered, PLOT, [
        [2000, 100],
        [3000, 250],
      ]),
      ...panelCounter(PANEL_METRICS.messagesDeliveredBytes, PLOT, [
        [2000, 800],
        [3000, 2000],
      ]),
      ...panelCounter(PANEL_METRICS.rangeMessagesDelivered, PLOT, [[2000, 40]]),
      ...panelCounter(PANEL_METRICS.rangeMessagesDeliveredBytes, PLOT, [[2000, 320]]),
    ];
    const events = [TelemetryRecordBuilder.panelEvent("panel.mount", PLOT, 1100)];

    // When
    const panels = summarizePanels(samples, events, ORIGIN);

    // Then
    expect(panels).toEqual({
      [PLOT]: {
        panelType: "Plot",
        mountedAtMs: 100,
        mounts: 1,
        messages: 250,
        messageBytes: 2000,
        rangeMessages: 40,
        rangeBytes: 320,
      },
    });
  });

  it("should report render mean, max and p90 of the window maxima of an adapter panel", () => {
    // Given a 3D panel with 10 windows of render observations (count, sum, max), then idle
    // windows that publish nothing
    const windows = Array.from({ length: 10 }, (_, index) => {
      const ts = 2000 + index * 1000;
      return [ts, 3, 3 * (index + 1), index + 1] as const;
    });
    const samples = [
      ...panelCounter(PANEL_METRICS.renderCount, THREE_D, [
        [2000, 15],
        [11_000, 30],
      ]),
      ...panelObservations(PANEL_METRICS.renderDurationMs, THREE_D, windows),
      ...panelCounter(PANEL_METRICS.renderSkipped, THREE_D, [[3000, 3]]),
      ...panelCounter(PANEL_METRICS.messagesDelivered, THREE_D, [[2000, 30]]),
      ...panelCounter(PANEL_METRICS.messagesRendered, THREE_D, [[2000, 12]]),
      ...panelCounter(PANEL_METRICS.messagesRenderedBytes, THREE_D, [[2000, 960]]),
    ];
    const events = [
      TelemetryRecordBuilder.panelEvent("panel.mount", THREE_D, 1200),
      TelemetryRecordBuilder.panelEvent("panel.firstRender", THREE_D, 1700),
    ];

    // When
    const panel = summarizePanels(samples, events, ORIGIN)?.[THREE_D];

    // Then delivered (pipeline) and rendered (frames handed to onRender) stay separate;
    // mean = Σsum / Σcount = 165 / 30, max = 10, nearest-rank p90 of the maxima 1..10 = 9
    expect(panel).toEqual({
      panelType: "3D",
      mountedAtMs: 200,
      firstRenderMs: 700,
      mounts: 1,
      messages: 30,
      messageBytes: 0,
      rangeMessages: 0,
      rangeBytes: 0,
      renderedMessages: 12,
      renderedBytes: 960,
      renders: 30,
      renderMeanMs: 5.5,
      renderMaxMs: 10,
      renderP90WindowMaxMs: 9,
      skipped: 3,
    });
  });

  it("should fall back to the observation count for renders without a render counter", () => {
    // Given only render-duration observations
    const samples = panelObservations(PANEL_METRICS.renderDurationMs, THREE_D, [
      [2000, 4, 8, 3],
      [3000, 2, 2, 1],
    ]);

    // When
    const panel = summarizePanels(samples, [], ORIGIN)?.[THREE_D];

    // Then
    expect(panel).toMatchObject({ renders: 6, renderMeanMs: 10 / 6, renderMaxMs: 3 });
  });

  it("should keep the first mounted lifetime of a remounted panel", () => {
    // Given a panel unmounted and remounted when the data source closes
    const events = [
      TelemetryRecordBuilder.panelEvent("panel.mount", PLOT, 1100),
      TelemetryRecordBuilder.panelEvent("panel.unmount", PLOT, 9000),
      TelemetryRecordBuilder.panelEvent("panel.mount", PLOT, 9010),
    ];

    // When
    const panel = summarizePanels([], events, ORIGIN)?.[PLOT];

    // Then
    expect(panel).toMatchObject({ mountedAtMs: 100, unmountedAtMs: 8000, mounts: 2 });
  });

  it("should list panels seen only in metrics and omit times without an origin", () => {
    // Given a panel counter without lifecycle events, and a mount event, but no origin
    const samples = panelCounter(PANEL_METRICS.messagesDelivered, PLOT, [[2000, 5]]);
    const events = [TelemetryRecordBuilder.panelEvent("panel.mount", THREE_D, 1100)];

    // When
    const panels = summarizePanels(samples, events, undefined);

    // Then
    expect(Object.keys(panels ?? {})).toEqual([THREE_D, PLOT]);
    expect(panels?.[PLOT]).toEqual({
      panelType: "Plot",
      mounts: 0,
      messages: 5,
      messageBytes: 0,
      rangeMessages: 0,
      rangeBytes: 0,
    });
    expect(panels?.[THREE_D]?.mountedAtMs).toBeUndefined();
  });

  it("should return undefined without panel telemetry", () => {
    // Given only non-panel records
    const samples = [
      TelemetryRecordBuilder.sample({ metric: "pipeline.messages.received", value: 1 }),
    ];
    const events = [TelemetryRecordBuilder.event({ name: "layout.applied" })];

    // When / Then
    expect(summarizePanels(samples, events, ORIGIN)).toBeUndefined();
  });
});

describe("summarizePanelsReady", () => {
  it("should use the latest firstRender among the panels that emitted one", () => {
    // Given a React panel (mount only, mounted last) and two adapter panels
    const events = [
      TelemetryRecordBuilder.panelEvent("panel.mount", THREE_D, 1100),
      TelemetryRecordBuilder.panelEvent("panel.mount", "3D!c", 1150),
      TelemetryRecordBuilder.panelEvent("panel.mount", PLOT, 1900),
      TelemetryRecordBuilder.panelEvent("panel.firstRender", THREE_D, 1500),
      TelemetryRecordBuilder.panelEvent("panel.firstRender", "3D!c", 1600),
    ];

    // When
    const ready = summarizePanelsReady(events, ORIGIN);

    // Then
    expect(ready).toEqual({
      panelsReadyMs: 600,
      panelsReadyCoverage: { mounted: 3, firstRendered: 2 },
    });
  });

  it("should fall back to the latest first mount when no panel emitted firstRender", () => {
    // Given React panels only, one of them remounted later (ignored: first mount per panel)
    const events = [
      TelemetryRecordBuilder.panelEvent("panel.mount", PLOT, 1100),
      TelemetryRecordBuilder.panelEvent("panel.mount", "RawMessages!d", 1300),
      TelemetryRecordBuilder.panelEvent("panel.unmount", PLOT, 9000),
      TelemetryRecordBuilder.panelEvent("panel.mount", PLOT, 9010),
    ];

    // When
    const ready = summarizePanelsReady(events, ORIGIN);

    // Then
    expect(ready).toEqual({
      panelsReadyMs: 300,
      panelsReadyCoverage: { mounted: 2, firstRendered: 0 },
    });
  });

  it("should report coverage only without an origin and nothing without panel events", () => {
    // Given
    const events = [TelemetryRecordBuilder.panelEvent("panel.mount", PLOT, 1100)];

    // When / Then
    expect(summarizePanelsReady(events, undefined)).toEqual({
      panelsReadyCoverage: { mounted: 1, firstRendered: 0 },
    });
    expect(summarizePanelsReady([], ORIGIN)).toEqual({});
  });
});
