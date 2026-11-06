// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BenchmarkResultBuilder } from "./builders/BenchmarkResultBuilder";
import {
  buildExercisesLines,
  buildOverheadTable,
  buildPanelsSection,
  buildPanelsTable,
  buildPipelineLine,
  buildResultsTable,
  buildScorecardTable,
  latestResults,
} from "./summaryMarkdown";
import { CpuProfileBuilder } from "../result/builders/CpuProfileBuilder";
import { RunInfoBuilder } from "../result/builders/RunInfoBuilder";
import { BenchmarkResultV1, buildResultV1 } from "../result/schemaV1";
import { OverheadRunBuilder } from "../runner/builders/OverheadRunBuilder";
import { ToggleBlockBuilder } from "../runner/builders/ToggleBlockBuilder";
import { buildOverheadReport } from "../runner/overhead";
import type { OverheadArm } from "../runner/overhead.types";
import { armOrder } from "../runner/overheadSchedule";

const MIB = 1024 * 1024;

function makeResult(
  overrides: {
    scenarioId?: string;
    platform?: "web" | "electron";
    finishedAtWall?: string;
    withPool?: boolean;
  } = {},
): BenchmarkResultV1 {
  const labels = { poolId: "pool-1" };
  const pool = (metric: string, value: number) => ({
    kind: "sample" as const,
    realm: "worker:1",
    sequence: 0,
    monotonicTs: 1000,
    metric: `pipeline.hydratedSourcePool.${metric}`,
    value,
    unit: "count" as const,
    scope: "pipeline" as const,
    metricType: "counter" as const,
    labels,
  });
  return buildResultV1({
    run: RunInfoBuilder.run({
      scenarioId: overrides.scenarioId ?? "sinewave",
      platform: overrides.platform ?? "web",
      finishedAtWall: overrides.finishedAtWall ?? "2026-01-01T00:00:05.000Z",
      endMonotonicTs: 5000,
    }),
    pageRecords:
      overrides.withPool === true
        ? [
            pool("acquires", 3),
            pool("releases", 3),
            pool("activePins", 0),
            pool("overBudgetPeriods", 2),
            { ...pool("overBudgetDurationMs", 1500), unit: "ms" },
          ]
        : [],
    drainedDropped: 0,
    drainRealm: "renderer",
    hostSamples: [
      {
        monotonicTs: 1000,
        pid: 1,
        processType: "browser",
        workingSetBytes: 100 * MIB,
        cpuPercent: 12.5,
      },
    ],
    listenerDispatchSamples: [
      { monotonicTs: 1000, value: 1 },
      { monotonicTs: 1001, value: 3 },
    ],
  });
}

describe("latestResults", () => {
  it("keeps the latest run per scenario and platform", () => {
    // Given two web sinewave runs and one electron run
    const older = makeResult({ finishedAtWall: "2026-01-01T00:00:01.000Z" });
    const newer = makeResult({ finishedAtWall: "2026-01-02T00:00:01.000Z" });
    const electron = makeResult({ platform: "electron" });

    // When
    const latest = latestResults([older, electron, newer]);

    // Then
    expect(latest).toEqual([electron, newer]);
  });

  it("should drop overhead A/B runs, so they never feed the tables or the scorecard", () => {
    // Given a scenario run and a newer overhead run of the same scenario × platform × mode
    const scenarioRun = makeResult({ finishedAtWall: "2026-01-01T00:00:01.000Z" });
    const overheadRun = BenchmarkResultBuilder.result({
      platform: "web",
      mode: "overhead",
      finishedAtWall: "2026-01-02T00:00:01.000Z",
    });

    // When
    const latest = latestResults([scenarioRun, overheadRun]);
    const scorecard = buildScorecardTable([overheadRun], []);

    // Then
    expect(latest).toEqual([scenarioRun]);
    expect(buildResultsTable([overheadRun])).not.toContain("| sinewave |");
    expect(scorecard).not.toContain("| web |");
  });
});

describe("buildResultsTable", () => {
  it("renders one row per run with pool columns", () => {
    // Given
    const results = [makeResult({ scenarioId: "mcap-multi-ingest", withPool: true }), makeResult()];

    // When
    const markdown = buildResultsTable(results);

    // Then
    const rows = markdown.trim().split("\n");
    expect(rows).toHaveLength(4);
    expect(rows[2]).toBe(
      "| mcap-multi-ingest | web | on | 100.0 MiB | 12.5 % | — | 1.00 / 3.00 ms | — | — | ✅ | 2 / 1500 ms |",
    );
    expect(rows[3]).toContain("| sinewave | web | on |");
    expect(rows[3]).toContain("| — | — |");
  });

  it("reports when there are no results", () => {
    // Given / When / Then
    expect(buildResultsTable([])).toContain("No benchmark-result.v1 files found.");
  });
});

function withSummary(
  result: BenchmarkResultV1,
  summary: Partial<BenchmarkResultV1["summary"]>,
): BenchmarkResultV1 {
  return { ...result, summary: { ...result.summary, ...summary } };
}

describe("buildPipelineLine", () => {
  it("renders rates, fanout, cache and remote figures", () => {
    // Given
    const result = withSummary(makeResult(), {
      pipeline: {
        messagesReceived: 6000,
        messagesPerSec: 1234.4,
        bytesPerSec: 2.5 * MIB,
        deliveredFanout: 2,
        blockCachePeakBytes: 64 * MIB,
        sourceCacheHitRatio: 0.75,
        remoteBytesRead: 10 * MIB,
      },
    });

    // When
    const line = buildPipelineLine(result);

    // Then
    expect(line).toBe(
      "Pipeline: 1234 msg/s · 2.50 MiB/s · fanout 2.00 · block cache peak 64.0 MiB · " +
        "source cache hit ratio 75.0 % · remote read 10.0 MiB",
    );
  });

  it("renders dashes for missing pipeline figures", () => {
    // Given / When / Then
    expect(
      buildPipelineLine(withSummary(makeResult(), { pipeline: { messagesReceived: 0 } })),
    ).toBe(
      "Pipeline: — msg/s · — MiB/s · fanout — · block cache peak — · source cache hit ratio — · remote read —",
    );
    expect(buildPipelineLine(makeResult())).toBe("Pipeline: —");
  });
});

describe("buildPanelsTable", () => {
  it("renders one row per panel with dashes for React panels' render stats", () => {
    // Given an adapter panel (3D) and a React panel (Plot)
    const result = withSummary(makeResult(), {
      panels: {
        "3D!a": {
          panelType: "3D",
          mountedAtMs: 100,
          firstRenderMs: 1234.4,
          mounts: 1,
          messages: 120,
          messageBytes: 2048,
          rangeMessages: 0,
          rangeBytes: 0,
          renders: 30,
          renderMeanMs: 4,
          renderMaxMs: 8.25,
          renderP90WindowMaxMs: 8,
          skipped: 1,
        },
        "Plot!a": {
          panelType: "Plot",
          mountedAtMs: 90,
          mounts: 1,
          messages: 600,
          messageBytes: 0,
          rangeMessages: 5000,
          rangeBytes: 3 * MIB,
        },
      },
    });

    // When
    const table = buildPanelsTable(result);

    // Then
    expect(table.split("\n")).toEqual([
      "| Panel | Type | Messages | Bytes | Range msgs | Render mean / max | First render |",
      "|-------|------|----------|-------|------------|-------------------|--------------|",
      "| 3D!a | 3D | 120 | 2.0 KiB | 0 | 4.00 / 8.25 ms (30) | 1234 ms |",
      "| Plot!a | Plot | 600 | 0 B | 5000 | — | — |",
    ]);
  });

  it("reports missing panel telemetry", () => {
    // Given / When / Then
    expect(buildPanelsTable(makeResult())).toBe("No panel telemetry.");
  });
});

describe("buildPanelsSection", () => {
  it("renders the latest telemetry-on run per scenario with panels-ready coverage", () => {
    // Given a telemetry-on run and a telemetry-off run of the same scenario
    const on = withSummary(makeResult({ scenarioId: "pointcloud" }), {
      phases: {
        origin: "app.ready",
        panelsReadyMs: 1500,
        panelsReadyCoverage: { mounted: 2, firstRendered: 1 },
      },
      pipeline: { messagesReceived: 10, messagesPerSec: 10 },
    });
    const off = makeResult({
      scenarioId: "pointcloud",
      finishedAtWall: "2026-01-03T00:00:00.000Z",
    });
    const offRun = { ...off, run: { ...off.run, telemetryEnabled: false } };

    // When
    const section = buildPanelsSection([on, offRun]);

    // Then
    expect(section).toBe(
      [
        "",
        "### pointcloud (web)",
        "",
        "Pipeline: 10 msg/s · — MiB/s · fanout — · block cache peak — · source cache hit ratio — · remote read —",
        "",
        "Panels ready: 1500 ms after app.ready (firstRender from 1 of 2 mounted panels)",
        "",
        "No panel telemetry.",
        "",
      ].join("\n"),
    );
  });

  it("reports when there is no telemetry-on run", () => {
    // Given
    const off = makeResult();
    const offRun = { ...off, run: { ...off.run, telemetryEnabled: false } };

    // When / Then
    expect(buildPanelsSection([offRun])).toBe(
      "\nNo benchmark-result.v1 files with telemetry found.\n",
    );
    expect(buildPanelsSection([])).toBe("\nNo benchmark-result.v1 files with telemetry found.\n");
  });
});

describe("buildOverheadTable", () => {
  it("renders the pair statistics, verdict, self-cost and the report-only note", () => {
    // Given 5 pairs with +1 % CPU and +5 MiB
    const report = BenchmarkResultBuilder.overhead({ platform: "web" });

    // When
    const markdown = buildOverheadTable([report]);

    // Then
    expect(markdown).toContain("Report only unless `BENCHMARK_OVERHEAD_GATE=1`");
    expect(markdown).toContain(
      "| web | sinewave | relaunch | 5 | +1.00 % [+1.00, +1.00] (+1.0 pp [+1.0, +1.0]) IQR 0.00 % | +5.0 MiB [+5.0, +5.0] | ✅ within | — | 2.00 ms/s (0.20 % core) · 100 rec/s · 200 ns/rec | blocked +1.0 ms/s · -1.0 fps |",
    );
  });

  it("marks single-pair reports inconclusive and adds the UA-probe rows", () => {
    // Given a single-pair report and a report with the on-noUa arm
    const single = BenchmarkResultBuilder.overhead({ repeats: 1 });
    const arms: OverheadArm[] = ["off", "on", "on-noUa"];
    const memMiB: Record<OverheadArm, number> = { off: 500, on: 510, "on-noUa": 502 };
    const ua = buildOverheadReport({
      platform: "web",
      scenarioId: "pointcloud",
      runs: [0, 1, 2].flatMap((repeat) =>
        armOrder(arms, repeat).map((arm, order) =>
          OverheadRunBuilder.input({ arm, repeat, order, wsBytes: memMiB[arm] * MIB }),
        ),
      ),
      config: OverheadRunBuilder.config({ arms }),
    });

    // When
    const markdown = buildOverheadTable([single, ua]);

    // Then
    expect(markdown).toContain(
      "| electron | sinewave | relaunch | 1 | +1.00 % (+1.0 pp) | +5.0 MiB | ❔ inconclusive |",
    );
    expect(markdown).toContain(
      "| web | ↳ without UA probe | relaunch | 3 | 0.00 % [0.00, 0.00] (0.0 pp [0.0, 0.0]) IQR 0.00 % | +2.0 MiB [+2.0, +2.0] | ✅ within |",
    );
    expect(markdown).toContain(
      "| web | ↳ UA probe cost | relaunch | 3 | 0.00 % [0.00, 0.00] (0.0 pp [0.0, 0.0]) IQR 0.00 % | +8.0 MiB [+8.0, +8.0] | — |",
    );
  });

  it("takes CPU from the toggle A/B and adds the relaunch A/B as an informational sub-row", () => {
    // Given a both-method report: toggle +1.5 %, relaunch +5 % CPU (exceeds) and +5 MiB
    const toggle = ToggleBlockBuilder.summary(
      Array.from({ length: 6 }, () => ({ off: 100, on: 101.5 })),
    );
    const report = BenchmarkResultBuilder.overhead({ method: "both", toggle, cpuOn: 105 });

    // When
    const markdown = buildOverheadTable([report]);

    // Then
    expect(markdown).toContain(
      "| electron | sinewave | both (CPU toggle · mem relaunch) | 6 quartets | +1.50 % [+1.50, +1.50] (+1.5 pp [+1.5, +1.5]) IQR 0.00 % | +5.0 MiB [+5.0, +5.0] | ✅ within | toggle ≤ 5 ms |",
    );
    expect(markdown).toContain(
      "| electron | ↳ relaunch A/B (CPU informational) | relaunch | 5 | +5.00 % [+5.00, +5.00] (+5.0 pp [+5.0, +5.0]) IQR 0.00 % | +5.0 MiB [+5.0, +5.0] | ❌ exceeds | — |",
    );
  });

  it("adds the toggle A/B without the UA probe as an informational sub-row", () => {
    // Given a web toggle report (+1 %) with a toggle A/B without the UA probe (+0.5 %)
    const toggleWithoutUaProbe = ToggleBlockBuilder.summary(
      Array.from({ length: 6 }, () => ({ off: 100, on: 100.5 })),
    );
    const report = BenchmarkResultBuilder.overhead({
      method: "toggle",
      platform: "web",
      toggleWithoutUaProbe,
    });

    // When
    const markdown = buildOverheadTable([report]);

    // Then
    expect(markdown).toContain(
      "| web | ↳ toggle without UA probe (informational) | toggle | 6 quartets | +0.50 % [+0.50, +0.50] (+0.5 pp [+0.5, +0.5]) IQR 0.00 % | not measured | ✅ within | toggle ≤ 5 ms | | |",
    );
  });

  it("adds the benchmark FPS probe as a sub-row without a verdict, with the per-process deltas", () => {
    // Given an Electron toggle report with a frame probe of +7 % (GPU +4 pp, renderer +3 pp)
    const toggleFrameProbe = ToggleBlockBuilder.summary(
      Array.from({ length: 6 }, () => ({ off: 100, on: 107 })),
      ToggleBlockBuilder.processSplit(
        { off: { renderer: 80, gpu: 20 }, on: { renderer: 83, gpu: 24 } },
        6,
      ),
    );
    const report = BenchmarkResultBuilder.overhead({ method: "toggle", toggleFrameProbe });

    // When
    const markdown = buildOverheadTable([report]);

    // Then
    expect(markdown).toContain(
      "| electron | ↳ benchmark FPS probe (harness, not shipped) | toggle | 6 quartets | +7.00 % [+7.00, +7.00] (+7.0 pp [+7.0, +7.0]) IQR 0.00 % | not measured | — | toggle ≤ 5 ms · gpu +4.00 pp (6/6 ↑) · renderer +3.00 pp (6/6 ↑) | | |",
    );
  });

  it("adds the direct attribution as a sub-row with its own verdict", () => {
    // Given a toggle report with a direct attribution of 0.2 ms/s (≤ 0.3 ms/s) over 300 ms/s
    const report = BenchmarkResultBuilder.overhead({
      method: "toggle",
      platform: "web",
      directAttribution: CpuProfileBuilder.measured(),
    });

    // When
    const markdown = buildOverheadTable([report]);

    // Then
    expect(markdown).toContain(
      "| web | ↳ direct (JS only) | direct | 10 s profile @ 100 µs | +0.07 % (≤ +0.10 %) (+0.02 pp) | not measured | ✅ within | JS stacks 120.0 ms/s (wall) · resolved 99.9 % · GC 5.0 % (not attributable) · top: record (BufferedTelemetrySink.ts:40) 0.15 ms/s; onFrame (FrameCollector.ts:12) 0.05 ms/s | | |",
    );
  });

  it("shows an unsupported direct attribution with its reason", () => {
    // Given
    const report = BenchmarkResultBuilder.overhead({
      method: "toggle",
      directAttribution: CpuProfileBuilder.unsupported("No CDP session"),
    });

    // When
    const markdown = buildOverheadTable([report]);

    // Then
    expect(markdown).toContain(
      "| electron | ↳ direct (JS only) | direct | 10 s profile @ 100 µs | — | not measured | — | unsupported: No CDP session | | |",
    );
  });

  it("marks memory as not measured for method toggle", () => {
    // Given
    const report = BenchmarkResultBuilder.overhead({ method: "toggle", platform: "web" });

    // When
    const markdown = buildOverheadTable([report]);

    // Then
    expect(markdown).toContain(
      "| web | sinewave | toggle (mem not measured) | 6 quartets | +1.00 % [+1.00, +1.00] (+1.0 pp [+1.0, +1.0]) IQR 0.00 % | not measured | ✅ within | toggle ≤ 5 ms | — | — |",
    );
    expect(markdown).not.toContain("↳ relaunch");
  });

  it("reports when there are no overhead reports", () => {
    // Given / When / Then
    expect(buildOverheadTable([])).toContain("No overhead reports found.");
  });
});

describe("buildScorecardTable", () => {
  it("renders one row per platform, electron first, with the overhead of that platform", () => {
    // Given a web and an electron run, and a web overhead report
    const web = makeResult({ platform: "web" });
    const electron = makeResult({ platform: "electron" });
    const report = BenchmarkResultBuilder.overhead({ platform: "web" });

    // When
    const rows = buildScorecardTable([web, electron], [report]).trim().split("\n");

    // Then
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain("| Platform | Runs | Healthy | Peak WS (geomean)");
    expect(rows[2]).toMatch(/^\| electron \| 1 \| ✅ 1\/1 \| 100 MiB \| — \| 12\.5 % \|/);
    expect(rows[2]).toMatch(/\| — \|$/);
    expect(rows[3]).toMatch(/^\| web \| 1 \|/);
    expect(rows[3]).toContain("✅ within CPU ≤ +1.0 % / mem ≤ +5.0 MiB (n ≥ 5)");
  });

  it("ignores telemetry-off runs and reports when nothing is left", () => {
    // Given
    const off = makeResult();

    // When
    const markdown = buildScorecardTable(
      [{ ...off, run: { ...off.run, telemetryEnabled: false } }],
      [],
    );

    // Then
    expect(markdown).toContain(
      "No benchmark-result.v1 files with telemetry or overhead reports found.",
    );
  });

  it("should render a row for a platform when it has only an overhead report", () => {
    // Given an electron run and a web overhead report without any web run
    const electron = makeResult({ platform: "electron" });
    const report = BenchmarkResultBuilder.overhead({ platform: "web" });

    // When
    const rows = buildScorecardTable([electron], [report]).trim().split("\n");

    // Then: like the HTML scorecard, web is shown with no runs and its overhead verdict
    expect(rows).toHaveLength(4);
    expect(rows[2]).toMatch(/^\| electron \| 1 \|/);
    expect(rows[3]).toMatch(/^\| web \| 0 \|/);
    expect(rows[3]).toContain("✅ within CPU ≤ +1.0 % / mem ≤ +5.0 MiB (n ≥ 5)");
  });
});

describe("buildExercisesLines", () => {
  it("renders one line per scenario with its platforms, group, panels and player", () => {
    // Given sinewave on both platforms and a result without run.scenario
    const legacy = makeResult({ scenarioId: "old" });
    const { scenario: _scenario, ...legacyRun } = legacy.run;
    const results = [
      makeResult({ platform: "web" }),
      makeResult({ platform: "electron" }),
      { ...legacy, run: legacyRun },
    ];

    // When
    const lines = buildExercisesLines(results).trim().split("\n");

    // Then
    expect(lines).toEqual([
      "- **old** (web): scenario not recorded",
      "- **sinewave** (electron, web): time-series · Plot ×1 · SinewavePlayer",
    ]);
  });

  it("reports when there are no results", () => {
    // Given / When / Then
    expect(buildExercisesLines([])).toContain("No benchmark-result.v1 files found.");
  });
});
