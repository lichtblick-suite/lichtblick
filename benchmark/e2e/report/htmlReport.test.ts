// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BenchmarkResultBuilder } from "./builders/BenchmarkResultBuilder";
import { buildHtmlReport } from "./htmlReport";
import { escapeHtml } from "./htmlReportFormat";
import type { HtmlReportInput, LoadedResult } from "./types";
import { CpuProfileBuilder } from "../result/builders/CpuProfileBuilder";
import { ToggleBlockBuilder } from "../runner/builders/ToggleBlockBuilder";

const MIB = 1024 * 1024;
const CHART_JS_STUB = "window.Chart = function () {};";

function input(overrides: Partial<HtmlReportInput> = {}): HtmlReportInput {
  return {
    generatedAtWall: "2026-01-05T00:00:00.000Z",
    git: { commit: "0123456789abcdef", branch: "feature/x" },
    results: [],
    all: false,
    skipped: [],
    overheads: [],
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

  it("fills the overhead KPI cells from the matching report with verdict colors", () => {
    // Given an electron overhead report over the memory target and none for web
    const overheads = [BenchmarkResultBuilder.overhead({ memDeltaBytes: 30 * MIB })];

    // When
    const html = buildHtmlReport(input({ results: [sinewave, web], overheads }), {
      loadChartJs: () => CHART_JS_STUB,
    });

    // Then
    const rows = overviewRows(html);
    const electronRow = rows.find((row) => row.includes("<td>electron</td>"))!;
    const webRow = rows.find((row) => row.includes("<td>web</td>"))!;
    expect(electronRow).toMatch(/class="num good"[^>]*>\+1\.00 % \[\+1\.00, \+1\.00\]</);
    expect(electronRow).toMatch(/class="num bad"[^>]*>\+30\.0 MiB \[\+30\.0, \+30\.0\]</);
    expect(webRow).not.toContain("MiB");
    expect(html).toContain('<span class="badge bad">exceeds</span>');
  });

  it("should render the overhead table with pairs, CI95, flags and self-cost", () => {
    // Given a 5-pair web report and a single-pair electron report
    const overheads = [
      BenchmarkResultBuilder.overhead({ platform: "web" }),
      BenchmarkResultBuilder.overhead({ repeats: 1 }),
    ];

    // When
    const html = render({ results: [sinewave], overheads });

    // Then
    const section = html.slice(html.indexOf('id="telemetry-overhead"'), html.indexOf('id="runs"'));
    expect(section).toContain("<td>sinewave</td><td>web</td>");
    expect(section).toContain('<span class="badge good">within</span>');
    expect(section).toContain('<span class="badge warn">inconclusive</span>');
    expect(section).toContain(">+5.0 MiB [+5.0, +5.0]</td>");
    expect(section).toContain("2.00 ms/s (0.20 % core) · 100 rec/s · 200 ns/rec");
    expect(section).toContain("blocked +1.0 ms/s · -1.0 fps");
  });

  it("should show the toggle CPU with the relaunch A/B as an informational sub-row (both)", () => {
    // Given a both-method electron report (toggle +1.5 %, relaunch +5 % CPU) and a toggle-only
    // web report
    const toggle = ToggleBlockBuilder.summary(
      Array.from({ length: 6 }, () => ({ off: 100, on: 101.5 })),
    );
    const overheads = [
      BenchmarkResultBuilder.overhead({ method: "both", toggle, cpuOn: 105 }),
      BenchmarkResultBuilder.overhead({ method: "toggle", platform: "web" }),
    ];

    // When
    const html = render({ results: [sinewave, web], overheads });

    // Then: the overview KPI cells use the toggle CPU and mark the web memory as not measured
    const rows = overviewRows(html);
    const electronRow = rows.find((row) => row.includes("<td>electron</td>"))!;
    const webRow = rows.find((row) => row.includes("<td>web</td>"))!;
    expect(electronRow).toMatch(/class="num good"[^>]*>\+1\.50 % \[\+1\.50, \+1\.50\]</);
    expect(webRow).toContain(">not measured</td>");
    // And: the overhead section shows the method, the toggle pairs and the relaunch sub-row
    const section = html.slice(html.indexOf('id="telemetry-overhead"'), html.indexOf('id="runs"'));
    expect(section).toContain("<td>both (CPU toggle · mem relaunch)</td>");
    expect(section).toContain(
      'title="toggle: 6 ABBA quartets × 4 × 3000 ms blocks (500 ms settle), one launch; deltas per quartet (Σ on / Σ off − 1, linear drift cancels)"',
    );
    expect(section).toContain("↳ relaunch A/B (CPU informational)");
    expect(section).toContain(">+5.00 % [+5.00, +5.00]</td>");
    expect(section).toContain('<span class="badge bad">exceeds</span>');
    expect(section).toContain("<td>toggle (mem not measured)</td>");
    expect(section).toContain(">not measured</td>");
    expect(section).toContain("toggle ≤ 5 ms");
  });

  it("should show the toggle A/B without the UA probe as an informational sub-row", () => {
    // Given a web toggle report (+1 %) with a toggle A/B without the UA probe (+0.5 %)
    const toggleWithoutUaProbe = ToggleBlockBuilder.summary(
      Array.from({ length: 4 }, () => ({ off: 100, on: 100.5 })),
    );
    const overheads = [
      BenchmarkResultBuilder.overhead({ method: "toggle", platform: "web", toggleWithoutUaProbe }),
    ];

    // When
    const html = render({ results: [web], overheads });

    // Then
    const section = html.slice(html.indexOf('id="telemetry-overhead"'), html.indexOf('id="runs"'));
    expect(section).toContain("↳ toggle without UA probe (informational)");
    expect(section).toContain(">+0.50 % [+0.50, +0.50]</td>");
    expect(section).toContain(
      'title="toggle: 4 ABBA quartets × 4 × 3000 ms blocks (500 ms settle), own launch with ?telemetry.uaMemory=off"',
    );
  });

  it("should show the benchmark FPS probe as a sub-row without a verdict", () => {
    // Given an Electron toggle report with a frame probe of +7 % (GPU +4 pp)
    const toggleFrameProbe = ToggleBlockBuilder.summary(
      Array.from({ length: 4 }, () => ({ off: 100, on: 107 })),
      ToggleBlockBuilder.processSplit({ off: { gpu: 20 }, on: { gpu: 24 } }, 4),
    );
    const overheads = [BenchmarkResultBuilder.overhead({ method: "toggle", toggleFrameProbe })];

    // When
    const html = render({ results: [web], overheads });

    // Then
    const section = html.slice(html.indexOf('id="telemetry-overhead"'), html.indexOf('id="runs"'));
    expect(section).toContain("↳ benchmark FPS probe (harness, not shipped)");
    expect(section).toContain(">+7.00 % [+7.00, +7.00]</td>");
    expect(section).toContain(
      'title="toggle: 4 ABBA quartets × 4 × 3000 ms blocks (500 ms settle), own launch with ?telemetry=off, rAF loop toggled"',
    );
    expect(section).toContain("toggle ≤ 5 ms · gpu +4.00 pp (4/4 ↑)");
  });

  it("should show the direct attribution as a sub-row next to the toggle verdict", () => {
    // Given a web toggle report with a direct attribution
    const overheads = [
      BenchmarkResultBuilder.overhead({
        method: "toggle",
        platform: "web",
        directAttribution: CpuProfileBuilder.measured(),
      }),
    ];

    // When
    const html = render({ results: [web], overheads });

    // Then
    const section = html.slice(html.indexOf('id="telemetry-overhead"'), html.indexOf('id="runs"'));
    expect(section).toContain("↳ direct (JS only)");
    expect(section).toContain(">10 s profile @ 100 µs</td>");
    expect(section).toContain(">+0.07 % (≤ +0.10 %)</td>");
    expect(section).toContain(
      'title="telemetry 0.20 ms/s ÷ off CPU 300 ms/s = +0.07 % (≤ +0.10 %)"',
    );
    expect(section).toContain("top: record (BufferedTelemetrySink.ts:40) 0.15 ms/s");
  });

  it("should keep overhead A/B runs out of every scenario view and link their files", () => {
    // Given a scenario run, two overhead runs (newer) and their report
    const overheadOn = BenchmarkResultBuilder.loaded({
      ts: 7,
      mode: "overhead",
      finishedAtWall: "2026-01-03T00:00:00.000Z",
    });
    const overheadOff = BenchmarkResultBuilder.loaded({
      ts: 8,
      mode: "overhead",
      telemetryEnabled: false,
    });
    const report = BenchmarkResultBuilder.overhead({ repeats: 1 });

    // When
    const html = render({ results: [sinewave, overheadOn, overheadOff], overheads: [report] });

    // Then: only the scenario run is shown (overview, scorecard n, runs, chart data)
    expect(overviewRows(html)).toHaveLength(1);
    expect(html.match(/<details class="run"/g)).toHaveLength(1);
    expect(reportData(html).runs).toHaveLength(1);
    expect(html).toContain("1 run(s) shown");
    expect(html).toContain("2 overhead A/B run file(s) (telemetry overhead section only)");
    expect(html).not.toContain(overheadOn.fileName);
    // And: the overhead section links its runs' result files (relative to the report folder)
    const section = html.slice(html.indexOf('id="telemetry-overhead"'), html.indexOf('id="runs"'));
    expect(section).toContain("Run files: sinewave · electron (2)");
    for (const run of report.runs) {
      expect(section).toContain(`<a href="../${run.resultFile}">${run.resultFile}</a>`);
    }
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

  it("should order the sections Scorecard, By group, Overview, Coverage, overhead, Runs", () => {
    // Given
    const results: LoadedResult[] = [sinewave, web];

    // When
    const html = render({ results, overheads: [BenchmarkResultBuilder.overhead()] });

    // Then
    const ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toEqual([
      "scorecard",
      "by-group",
      "overview",
      "coverage",
      "telemetry-overhead",
      "runs",
    ]);
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
