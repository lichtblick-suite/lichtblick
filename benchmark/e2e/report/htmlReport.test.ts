// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BenchmarkResultBuilder } from "./builders/BenchmarkResultBuilder";
import { buildHtmlReport } from "./htmlReport";
import { escapeHtml } from "./htmlReportFormat";
import type { HtmlReportInput, LoadedResult } from "./types";

const CHART_JS_STUB = "window.Chart = function () {};";

function input(overrides: Partial<HtmlReportInput> = {}): HtmlReportInput {
  return {
    generatedAtWall: "2026-01-05T00:00:00.000Z",
    git: { commit: "0123456789abcdef", branch: "feature/x" },
    results: [],
    all: false,
    skipped: [],
    screenshotFiles: [],
    screenshotsHref: "../screenshots/",
    ...overrides,
  };
}

/** The overview table rows (one line each, carrying the filter tokens). */
function overviewRows(html: string): string[] {
  return html
    .split("\n")
    .filter((line) => line.startsWith("<tr data-tags=") && line.includes('<a href="#run-'));
}

function render(overrides: Partial<HtmlReportInput> = {}): string {
  return buildHtmlReport(input(overrides), { loadChartJs: () => CHART_JS_STUB });
}

function reportData(html: string): { runs: unknown[] } {
  const match = /<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(match![1]!) as { runs: unknown[] };
}

describe("buildHtmlReport", () => {
  const sinewave = BenchmarkResultBuilder.loaded({ ts: 1 });
  const web = BenchmarkResultBuilder.loaded({ ts: 2, platform: "web" });
  const off = BenchmarkResultBuilder.loaded({ ts: 3, telemetryEnabled: false });

  it("renders a KPI row per telemetry-on run and a section per selected run", () => {
    // Given
    const results: LoadedResult[] = [sinewave, web, off];

    // When
    const html = buildHtmlReport(input({ results }), { loadChartJs: () => CHART_JS_STUB });

    // Then: 3 sections (first open), 2 KPI rows linking to their sections
    expect(html.match(/<details class="run"/g)).toHaveLength(3);
    expect(html).toContain(
      '<details class="run" id="run-0" data-run="0" data-tags="group:time-series tag:plot tag:synthetic" open>',
    );
    expect(html).not.toMatch(/data-run="1"[^>]* open>/);
    expect(overviewRows(html)).toHaveLength(2);
    expect(html).toContain("branch feature/x");
    expect(html).toContain("commit 0123456789ab");
    expect(html).toContain("3 run(s) shown");
    expect(html).toContain("Markers (s from datasource.open): <span>layout.applied -0.80 s</span>");
    expect(reportData(html).runs).toHaveLength(3);
  });

  it("shows each run's finished time in grey and hints runs > 24 h older than the newest as stale", () => {
    // Given a fresh electron run and a web run from two days earlier
    const fresh = BenchmarkResultBuilder.loaded({
      ts: 5,
      finishedAtWall: "2026-10-30T16:44:39.102Z",
    });
    const old = BenchmarkResultBuilder.loaded({
      ts: 6,
      platform: "web",
      finishedAtWall: "2026-10-28T11:13:00.000Z",
    });

    // When
    const html = buildHtmlReport(input({ results: [fresh, old] }), {
      loadChartJs: () => CHART_JS_STUB,
    });

    // Then: a "Run" column; only the old row (and its section) carries the stale hint
    const rows = overviewRows(html);
    const freshRow = rows.find((row) => row.includes("<td>electron</td>"))!;
    const oldRow = rows.find((row) => row.includes("<td>web</td>"))!;
    expect(html).toContain("<th>Run</th>");
    expect(freshRow).toContain(
      '<span class="muted nowrap" title="2026-10-30T16:44:39.102Z">2026-10-30 16:44Z</span>',
    );
    expect(freshRow).not.toContain('class="stale"');
    expect(oldRow).toContain('2026-10-28 11:13Z</span> <span class="stale"');
    expect(oldRow).toContain("Finished 2 d before the newest run");
    expect(html.match(/class="stale"/g)).toHaveLength(2);
  });

  it("lists skipped files and links the screenshots relative to the report", () => {
    // Given
    const results = [sinewave];
    const screenshotFiles = ["sinewave-electron-1-end.png"];
    const skipped = [{ fileName: "old.benchmark-result.v1.json", reason: "not a valid result" }];

    // When
    const html = buildHtmlReport(input({ results, screenshotFiles, skipped }), {
      loadChartJs: () => CHART_JS_STUB,
    });

    // Then
    expect(html).toContain('src="../screenshots/sinewave-electron-1-end.png"');
    expect(html).toContain("1 invalid file(s) skipped");
    expect(html).toContain("old.benchmark-result.v1.json");
  });

  it("does not let a scenario name break out of the HTML or the JSON block", () => {
    // Given a hostile scenario id
    const evil = '</script><script>alert("x")</script><b>';
    const results = [BenchmarkResultBuilder.loaded({ scenarioId: evil })];

    // When
    const html = buildHtmlReport(input({ results }), { loadChartJs: () => CHART_JS_STUB });

    // Then: only the report's own 3 script blocks close; text and data stay escaped
    expect(html.match(/<\/script>/g)).toHaveLength(3);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain(escapeHtml(evil));
    expect(JSON.stringify(reportData(html))).toBeDefined();
  });

  it("calls the Chart.js loader exactly once and neutralizes '</script' in its source", () => {
    // Given
    const loadChartJs = jest.fn(() => 'var s = "</script>";');

    // When
    const html = buildHtmlReport(input({ results: [sinewave, web, off] }), { loadChartJs });

    // Then
    expect(loadChartJs).toHaveBeenCalledTimes(1);
    expect(html).toContain('var s = "<\\/script>";');
    expect(html.match(/<\/script>/g)).toHaveLength(3);
  });

  it("should show the scenario and render calibration in the environment table", () => {
    // Given
    const results: LoadedResult[] = [sinewave];

    // When
    const html = buildHtmlReport(input({ results }), { loadChartJs: () => CHART_JS_STUB });

    // Then
    const { scenario, environment } = sinewave.result.run;
    expect(html).toContain(escapeHtml(`${scenario!.group}: ${scenario!.description}`));
    expect(html).toContain(escapeHtml(environment.glRenderer!));
    expect(html).toContain(`<td>${environment.logicalCpus}</td>`);
    expect(html).not.toContain("not recorded");
  });

  it("should mark the scenario and render calibration of an older result as not recorded", () => {
    // Given
    const results: LoadedResult[] = [
      {
        fileName: "sinewave-electron-1.benchmark-result.v1.json",
        result: BenchmarkResultBuilder.legacy(),
      },
    ];

    // When
    const html = buildHtmlReport(input({ results }), { loadChartJs: () => CHART_JS_STUB });

    // Then
    expect(html).toContain("scenario not recorded");
    expect(html.match(/>not recorded</g)).toHaveLength(4);
  });

  it("should order the sections Scorecard, By group, Overview, Coverage, Runs", () => {
    // Given
    const results: LoadedResult[] = [sinewave, web];

    // When
    const html = render({ results });

    // Then
    const ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toEqual(["scorecard", "by-group", "overview", "coverage", "runs"]);
    expect(html).toContain("<h3>electron ");
    expect(html).toContain("<h3>web ");
    expect(html).toContain("<td>time-series</td><td>electron</td>");
    expect(html).toContain('<table class="coverage">');
  });

  it("should put chips under the scenario name and filter tokens on overview rows and runs", () => {
    // Given
    const results: LoadedResult[] = [sinewave];

    // When
    const html = render({ results });

    // Then
    const [row] = overviewRows(html);
    expect(row).toContain('<tr data-tags="group:time-series tag:plot tag:synthetic">');
    expect(row).toContain('data-filter="group:time-series"');
    expect(row).toContain(">SinewavePlayer<");
    expect(html).toContain(
      '<button type="button" class="chip chip-active" data-filter="">all</button>',
    );
    expect(html).toContain("hidden-by-filter");
  });

  it("should open each run section with its Exercises card and KPI table", () => {
    // Given
    const results: LoadedResult[] = [sinewave];

    // When
    const html = render({ results });

    // Then
    const section = html.slice(html.indexOf('<details class="run" id="run-0"'));
    expect(section.indexOf("<h3>Exercises</h3>")).toBeLessThan(section.indexOf("<h3>KPIs</h3>"));
    expect(section).toContain("⚠ no telemetry");
    expect(html).not.toContain("recomputed: this result predates");
  });

  it("should note recomputed KPIs of an older result", () => {
    // Given
    const legacy = BenchmarkResultBuilder.legacy();
    const results: LoadedResult[] = [
      {
        fileName: "sinewave-electron-1.benchmark-result.v1.json",
        result: {
          ...legacy,
          summary: {
            ...legacy.summary,
            kpis: { ...legacy.summary.kpis, recomputed: true },
          },
        },
      },
    ];

    // When
    const html = render({ results });

    // Then
    expect(html).toContain("recomputed: this result predates <code>summary.kpis</code>");
    expect(html).toContain("scenario not recorded (older result)");
  });

  it("should show the FPS ceiling and GL backend next to the median FPS", () => {
    // Given
    const results: LoadedResult[] = [sinewave];

    // When
    const html = render({ results });

    // Then
    const [row] = overviewRows(html);
    const { fpsCeiling } = sinewave.result.run.environment;
    expect(row).toContain(`/ ${fpsCeiling!.toFixed(0)}`);
    expect(html).toContain("<th>GL backend</th>");
  });

  it("renders an empty report without runs", () => {
    // Given / When
    const html = buildHtmlReport(input(), { loadChartJs: () => CHART_JS_STUB });

    // Then
    expect(html).toContain("No valid <code>*.benchmark-result.v1.json</code> found.");
    expect(html).toContain("the definitive results dashboard is planned as a follow-up");
  });
});
