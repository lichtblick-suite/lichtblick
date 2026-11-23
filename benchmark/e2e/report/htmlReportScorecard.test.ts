// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CPU_SCALE_NOTE } from "./constants";
import { escapeHtml } from "./htmlReportFormat";
import { byGroupHtml, scorecardHtml } from "./htmlReportScorecard";
import { RunKpisBuilder } from "../result/builders/RunKpisBuilder";

/** The scorecard cards of one platform heading. */
function cardsOf(html: string, platform: string): string {
  const start = html.indexOf(`<h3>${platform} `);
  const end = html.indexOf("<h3>", start + 1);
  return html.slice(start, end === -1 ? undefined : end);
}

describe("scorecardHtml", () => {
  const healthy = RunKpisBuilder.run({
    runId: "run-0",
    scenarioId: "sinewave",
    kpis: {
      memory: { peakTotalWorkingSetMiB: 400 },
      smoothness: { medianFps: 120, fpsPercentOfCeiling: 100 },
    },
  });
  const lowFpsWeb = RunKpisBuilder.run({
    runId: "run-1",
    scenarioId: "pointcloud",
    platform: "web",
    kpis: { smoothness: { medianFps: 2.4, lowFps: true } },
  });

  it("should render one card per family per platform, electron first", () => {
    // Given
    const runs = [lowFpsWeb, healthy];

    // When
    const html = scorecardHtml(runs);

    // Then
    expect(html.indexOf("<h3>electron ")).toBeLessThan(html.indexOf("<h3>web "));
    const electron = cardsOf(html, "electron");
    for (const title of [
      "Stability",
      "Memory",
      "CPU",
      "Smoothness",
      "Startup",
      "Throughput",
      "Render cost",
    ]) {
      expect(electron).toContain(`<h4>${title}</h4>`);
    }
    expect(electron).toContain('<div class="card kpi-card good"><h4>Stability</h4>');
    expect(electron).toContain("1/1 healthy (100 %)");
    expect(electron).toContain('<div class="kpi-value">400 MiB</div>');
    expect(electron).toContain(escapeHtml(CPU_SCALE_NOTE));
  });

  it("should always show web FPS and flag low-FPS runs without coloring them", () => {
    // Given
    const runs = [healthy, lowFpsWeb];

    // When
    const web = cardsOf(scorecardHtml(runs), "web");

    // Then
    expect(web).toContain(
      '<div class="card kpi-card"><h4>Smoothness</h4><div class="kpi-value">2.4 FPS</div>',
    );
    expect(web).toContain("⚠ 1 run(s) below 10 FPS");
    expect(web).toContain('<a href="#run-1">pointcloud</a> (2.4)');
    expect(web).toContain(escapeHtml(CPU_SCALE_NOTE));
  });

  it("should color an unhealthy platform and link its unhealthy runs", () => {
    // Given
    const crashed = RunKpisBuilder.run({
      runId: "run-2",
      scenarioId: "transform",
      kpis: { stability: { healthy: false, reasons: ["renderer.crash ×1"] } },
    });

    // When
    const electron = cardsOf(scorecardHtml([healthy, crashed]), "electron");

    // Then
    expect(electron).toContain('<div class="card kpi-card bad"><h4>Stability</h4>');
    expect(electron).toContain("1/2 healthy (50 %)");
    expect(electron).toContain('unhealthy: <a href="#run-2">transform</a>');
  });

  it("should explain a missing slope and escape scenario ids", () => {
    // Given
    const evil = RunKpisBuilder.run({
      runId: "run-3",
      scenarioId: "<img src=x>",
      kpis: { memory: { peakTotalWorkingSetMiB: 900 } },
    });

    // When
    const html = scorecardHtml([evil]);

    // Then
    expect(html).toContain("needs a steady window ≥ 10 s");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img src=x&gt;");
  });

  it("should say so without runs", () => {
    // Given / When / Then
    expect(scorecardHtml([])).toContain("No telemetry-on runs found.");
  });
});

describe("byGroupHtml", () => {
  it("should render group × platform rows with the primary KPI and its fallback note", () => {
    // Given a time-series run without Plot render telemetry, and a 3D run
    const runs = [
      RunKpisBuilder.run({
        runId: "run-0",
        summary: {
          listenerDispatchDurationMs: { count: 3, p50: 1, p90: 1.5, max: 2 },
        },
      }),
      RunKpisBuilder.run({
        runId: "run-1",
        scenarioId: "pointcloud",
        platform: "web",
        scenario: { group: "3d-rendering" },
        kpis: { smoothness: { onTimeFramePercent: 37 } },
      }),
    ];

    // When
    const html = byGroupHtml(runs);

    // Then
    expect(html).toContain("<th>Primary KPI</th>");
    expect(html).toContain("<td>time-series</td><td>electron</td>");
    expect(html).toContain("Listener dispatch p90: <b>1.50 ms</b>");
    expect(html).toContain("(fallback for Plot p90 render)");
    expect(html).toContain("<td>3d-rendering</td><td>web</td>");
    expect(html).toContain("On-time frames: <b>37.0 %</b>");
    expect(html).toContain("<td>pointcloud</td>");
  });

  it("should say so without grouped runs", () => {
    // Given / When / Then
    expect(byGroupHtml([RunKpisBuilder.run({ runId: "run-0", scenario: false })])).toContain(
      "No telemetry-on runs with a recorded scenario group.",
    );
  });
});
