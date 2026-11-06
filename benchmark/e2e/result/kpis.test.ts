// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { RunKpisBuilder } from "./builders/RunKpisBuilder";
import { LOW_FPS_WARNING } from "./constants";
import {
  aggregateKpis,
  aggregateOverhead,
  aggregateValues,
  computeRunKpis,
  groupKpis,
  withRunKpis,
} from "./kpis";
import type { OverheadKpiInput } from "./kpis.types";
import type { PanelSummaryV1, PoolSummaryV1, StoredResultV1 } from "./schemaV1";
import { BenchmarkResultBuilder } from "../report/builders/BenchmarkResultBuilder";

const MIB = 1024 * 1024;

function panel(panelType: string, renderP90WindowMaxMs?: number): PanelSummaryV1 {
  return {
    panelType,
    mounts: 1,
    messages: 0,
    messageBytes: 0,
    rangeMessages: 0,
    rangeBytes: 0,
    ...(renderP90WindowMaxMs != undefined && { renderP90WindowMaxMs }),
  };
}

function pool(overrides: Partial<PoolSummaryV1> = {}): PoolSummaryV1 {
  return {
    realm: "renderer",
    poolId: "p",
    acquires: 0,
    releases: 0,
    terminatedPins: 0,
    activePinsFinal: 0,
    invariantHolds: true,
    overBudgetPeriods: 0,
    overBudgetDurationMs: 0,
    evictions: 0,
    rehydrations: 0,
    highWaterResidentCount: 0,
    highWaterActivePins: 0,
    ...overrides,
  };
}

/** Overhead report fields with a CPU / memory CI95 around the given medians (n = 5 pairs). */
function overhead(
  overrides: Partial<OverheadKpiInput> & {
    cpu?: [lower: number, median: number, upper: number];
    memMiB?: [lower: number, median: number, upper: number];
  } = {},
): OverheadKpiInput {
  const { cpu = [0, 0.01, 0.015], memMiB = [2, 5, 8], ...rest } = overrides;
  return {
    platform: "electron",
    scenarioId: "sinewave",
    createdAtWall: "2026-01-01T00:00:00.000Z",
    n: 5,
    metrics: {
      cpuRelative: { n: 5, median: cpu[1], iqr: 0, ci95: { lower: cpu[0], upper: cpu[2] } },
      memBytes: {
        n: 5,
        median: memMiB[1] * MIB,
        iqr: 0,
        ci95: { lower: memMiB[0] * MIB, upper: memMiB[2] * MIB },
      },
    },
    verdicts: { overall: "within" },
    targets: { cpuDeltaRelativeMax: 0.02, memDeltaBytesMax: 20 * MIB },
    ...rest,
  };
}

describe("computeRunKpis", () => {
  it("should derive every family from the summaries", () => {
    // Given a 10 s run (window ends at 8 s) at 60 Hz with frames, long tasks, pipeline and panels
    const input = RunKpisBuilder.input({
      run: {
        startMonotonicTs: 0,
        endMonotonicTs: 10_000,
        windowEndMonotonicTs: 8000,
        environment: { fpsCeiling: 60 },
      },
      summary: {
        process: {
          sampleCount: 8,
          peakTotalWorkingSetBytes: 512 * MIB,
          meanTotalWorkingSetBytes: 400 * MIB,
          medianTotalCpuPercent: 80,
          totalWorkingSetSlopeMiBPerMin: 2.5,
          cpuSeconds: 4,
          byType: {},
        },
        renderer: { medianFps: 30, lateFrames: 30, totalFrames: 300, longTaskTotalMs: 500 },
        phases: { panelsReadyMs: 900, firstMessageMs: 400 },
        pipeline: { bytesPerSec: 2 * MIB, messagesPerSec: 100, deliveredFanout: 1.5 },
        panels: {
          "3D!a": panel("3D", 12),
          "3D!b": panel("3D", 30),
          "Plot!a": panel("Plot"),
          "Image!a": panel("Image", 8),
        },
      },
    });

    // When
    const kpis = computeRunKpis(input);

    // Then
    expect(kpis).toEqual({
      stability: { healthy: true, reasons: [] },
      memory: { peakTotalWorkingSetMiB: 512, workingSetSlopeMiBPerMin: 2.5 },
      // 4 CPU s over 2 MiB/s × 8 s = 16 MiB
      cpu: { medianCpuPercent: 80, cpuSeconds: 4, cpuSecondsPerMiB: 0.25 },
      smoothness: {
        medianFps: 30,
        fpsCeiling: 60,
        fpsPercentOfCeiling: 50,
        onTimeFramePercent: 90,
        longTaskBlockedMsPerSec: 50,
        lowFps: false,
      },
      startup: { panelsReadyMs: 900, firstMessageMs: 400 },
      throughput: { ingestMiBPerSec: 2, messagesPerSec: 100, fanout: 1.5 },
      renderCost: {
        worstPanelP90RenderMs: 30,
        worstPanelId: "3D!b",
        worstPanelType: "3D",
        p90RenderMsByPanelType: { "3D": 30, Image: 8 },
      },
    });
  });

  it("should list why a run is not healthy", () => {
    // Given a crash, a broken pool invariant and dropped records
    const input = RunKpisBuilder.input({
      dropped: { renderer: 3, worker: 2 },
      summary: {
        runnerEvents: { "renderer.crash": 1, "process.gone": 0, "renderer.reload": 0 },
        hydratedSourcePool: { pools: { "renderer/p": pool({ invariantHolds: false }) } },
      },
    });

    // When
    const { stability } = computeRunKpis(input);

    // Then
    expect(stability).toEqual({
      healthy: false,
      reasons: [
        "renderer.crash ×1",
        "pool invariant violated (renderer/p)",
        "5 telemetry records dropped",
      ],
    });
  });

  it("should keep the median FPS of low-FPS runs and flag them", () => {
    // Given a web run at 2 FPS without a calibrated ceiling
    const input = RunKpisBuilder.input({
      run: { startMonotonicTs: 0, endMonotonicTs: 5000, environment: { fpsCeiling: 0 } },
      summary: { renderer: { medianFps: 2 } },
    });

    // When
    const { smoothness } = computeRunKpis(input);

    // Then
    expect(LOW_FPS_WARNING).toBe(10);
    expect(smoothness.medianFps).toBe(2);
    expect(smoothness.lowFps).toBe(true);
    expect(smoothness.fpsCeiling).toBeUndefined();
    expect(smoothness.fpsPercentOfCeiling).toBeUndefined();
  });

  it("should omit values whose inputs are missing", () => {
    // Given no host polls, frames, pipeline or panels
    const input = RunKpisBuilder.input({
      summary: { process: { ...RunKpisBuilder.summary().process, sampleCount: 0 } },
    });

    // When
    const kpis = computeRunKpis(input);

    // Then
    expect(kpis.memory.peakTotalWorkingSetMiB).toBeUndefined();
    expect(kpis.cpu.medianCpuPercent).toBeUndefined();
    expect(kpis.cpu.cpuSecondsPerMiB).toBeUndefined();
    expect(kpis.smoothness).toMatchObject({ lowFps: false });
    expect(kpis.smoothness.medianFps).toBeUndefined();
    expect(kpis.smoothness.onTimeFramePercent).toBeUndefined();
    expect(kpis.throughput.ingestMiBPerSec).toBeUndefined();
    expect(kpis.renderCost).toMatchObject({ p90RenderMsByPanelType: {} });
    expect(kpis.renderCost.worstPanelId).toBeUndefined();
  });
});

describe("withRunKpis", () => {
  it("should backfill missing KPIs and mark them recomputed", () => {
    // Given a result written before summary.kpis existed
    const result = BenchmarkResultBuilder.result();
    const { kpis, ...summary } = result.summary;
    const stored: StoredResultV1 = { ...result, summary };

    // When
    const loaded = withRunKpis(stored);

    // Then
    expect(loaded.summary.kpis).toEqual({ ...kpis, recomputed: true });
  });

  it("should keep stored KPIs unchanged", () => {
    // Given
    const result = BenchmarkResultBuilder.result();

    // When
    const loaded = withRunKpis(result);

    // Then
    expect(loaded.summary.kpis).toBe(result.summary.kpis);
    expect(loaded.summary.kpis.recomputed).toBeUndefined();
  });
});

describe("aggregateValues", () => {
  const ref = (runId: string) => ({ scenarioId: runId, runId });

  it("should combine with the policy and return the worst run", () => {
    // Given
    const values = [
      { ref: ref("a"), value: 10 },
      { ref: ref("b"), value: undefined },
      { ref: ref("c"), value: 1000 },
    ];

    // When
    const geomean = aggregateValues(values, { aggregate: "geomean", worst: "max" });
    const min = aggregateValues(values, { aggregate: "min", worst: "min" });
    const sum = aggregateValues(values, { aggregate: "sum", worst: "max" });

    // Then
    expect(geomean.value).toBeCloseTo(100, 10);
    expect(geomean).toMatchObject({ n: 2, worst: { runId: "c", value: 1000 } });
    expect(min).toEqual({ value: 10, n: 2, worst: { scenarioId: "a", runId: "a", value: 10 } });
    expect(sum).toMatchObject({ value: 1010, n: 2 });
  });

  it("should report n = 0 without values", () => {
    // Given / When / Then
    expect(aggregateValues([], { aggregate: "max", worst: "max" })).toEqual({ n: 0 });
  });
});

describe("aggregateKpis", () => {
  it("should aggregate one platform's telemetry-on runs with the scorecard policies", () => {
    // Given two electron runs, an electron telemetry-off run and a web run
    const runs = [
      RunKpisBuilder.run({
        runId: "run-0",
        scenarioId: "sinewave",
        kpis: {
          memory: { peakTotalWorkingSetMiB: 100, workingSetSlopeMiBPerMin: 1 },
          smoothness: { medianFps: 120, onTimeFramePercent: 99 },
          renderCost: { p90RenderMsByPanelType: { "3D": 5 } },
        },
      }),
      RunKpisBuilder.run({
        runId: "run-1",
        scenarioId: "pointcloud",
        kpis: {
          stability: { healthy: false, reasons: ["renderer.crash ×1"] },
          memory: { peakTotalWorkingSetMiB: 400, workingSetSlopeMiBPerMin: 7 },
          smoothness: { medianFps: 3, onTimeFramePercent: 40, lowFps: true },
          renderCost: { p90RenderMsByPanelType: { "3D": 600 } },
        },
      }),
      RunKpisBuilder.run({
        runId: "run-2",
        telemetryEnabled: false,
        kpis: { memory: { peakTotalWorkingSetMiB: 1 } },
      }),
      RunKpisBuilder.run({
        runId: "run-3",
        platform: "web",
        kpis: { memory: { peakTotalWorkingSetMiB: 10_000 } },
      }),
    ];

    // When
    const scorecard = aggregateKpis(runs, "electron");

    // Then
    expect(scorecard.runs).toBe(2);
    expect(scorecard.stability).toEqual({
      healthy: 1,
      total: 2,
      unhealthy: [{ scenarioId: "pointcloud", runId: "run-1" }],
    });
    expect(scorecard.metrics.peakTotalWorkingSetMiB.value).toBeCloseTo(200, 10);
    expect(scorecard.metrics.peakTotalWorkingSetMiB.worst).toMatchObject({ runId: "run-1" });
    expect(scorecard.metrics.workingSetSlopeMiBPerMin).toMatchObject({ value: 7, n: 2 });
    expect(scorecard.metrics.medianFps).toMatchObject({ value: 3, worst: { runId: "run-1" } });
    expect(scorecard.metrics.onTimeFramePercent.value).toBe(40);
    expect(scorecard.metrics.cpuSecondsPerMiB).toEqual({ n: 0 });
    expect(scorecard.renderCostByPanelType["3D"]).toMatchObject({ value: 600, n: 2 });
    expect(scorecard.lowFpsRuns).toEqual([
      { scenarioId: "pointcloud", runId: "run-1", medianFps: 3 },
    ]);
    expect(scorecard.overhead).toBeUndefined();
  });

  it("should never mix platforms", () => {
    // Given
    const runs = [
      RunKpisBuilder.run({ runId: "e", kpis: { smoothness: { medianFps: 120 } } }),
      RunKpisBuilder.run({ runId: "w", platform: "web", kpis: { smoothness: { medianFps: 2 } } }),
    ];

    // When
    const electron = aggregateKpis(runs, "electron");
    const web = aggregateKpis(runs, "web");

    // Then: web FPS is reported even when low
    expect(electron.metrics.medianFps).toMatchObject({ value: 120, n: 1 });
    expect(web.metrics.medianFps).toMatchObject({ value: 2, n: 1, worst: { runId: "w" } });
  });

  it("should attach the overhead worst case of the platform's latest reports", () => {
    // Given an older exceeding and a newer within sinewave report, an inconclusive single-pair
    // pointcloud report, and a web report
    const overheads = [
      overhead({ createdAtWall: "2026-01-01T00:00:00.000Z", verdicts: { overall: "exceeds" } }),
      overhead({ createdAtWall: "2026-01-02T00:00:00.000Z" }),
      overhead({
        scenarioId: "pointcloud",
        n: 1,
        cpu: [0.025, 0.025, 0.025],
        memMiB: [12, 12, 12],
        verdicts: { overall: "inconclusive" },
      }),
      overhead({ platform: "web", verdicts: { overall: "exceeds" } }),
    ];

    // When
    const result = aggregateKpis([], "electron", overheads).overhead;

    // Then
    expect(result).toEqual({
      reports: 2,
      verdict: "inconclusive",
      minPairs: 1,
      totalPairs: 6,
      cpuVerdictSources: { toggle: 0, relaunch: 2 },
      memNotMeasuredReports: 0,
      worstCpuRelative: {
        scenarioId: "pointcloud",
        ciUpper: 0.025,
        median: 0.025,
      },
      worstMemMiB: { scenarioId: "pointcloud", ciUpper: 12, median: 12 },
      targets: { cpuDeltaRelativeMax: 0.02, memDeltaMiBMax: 20 },
    });
  });

  it("should rank exceeds as the worst verdict and pick the highest CI upper bound", () => {
    // Given a within report with a wide memory CI and an exceeding one
    const overheads = [
      overhead({ memMiB: [-5, 3, 18] }),
      overhead({
        scenarioId: "mcap-multi-ingest",
        cpu: [0.03, 0.04, 0.05],
        verdicts: { overall: "exceeds" },
      }),
    ];

    // When
    const result = aggregateOverhead(overheads, "electron");

    // Then
    expect(result?.verdict).toBe("exceeds");
    expect(result?.worstCpuRelative).toEqual({
      scenarioId: "mcap-multi-ingest",
      ciUpper: 0.05,
      median: 0.04,
    });
    expect(result?.worstMemMiB).toEqual({ scenarioId: "sinewave", ciUpper: 18, median: 3 });
  });

  it("should skip a report without a CPU CI95 when picking the worst CPU scenario", () => {
    // Given a report whose CPU has a median but no CI95, next to one with a lower CI upper bound
    const noCi = overhead({ scenarioId: "pointcloud" });
    noCi.metrics.cpuRelative = { n: 1, median: 0.5 };
    const overheads = [noCi, overhead({ cpu: [0, 0.01, 0.015] })];

    // When
    const result = aggregateOverhead(overheads, "electron");

    // Then: the median is not used as an upper bound
    expect(result?.worstCpuRelative).toEqual({
      scenarioId: "sinewave",
      ciUpper: 0.015,
      median: 0.01,
    });
  });

  it("should take CPU from the toggle A/B and memory only from reports that measured it", () => {
    // Given a toggle-only sinewave report (memory not measured) and a both-method pointcloud
    // report whose relaunch CPU (informational) is worse than its toggle CPU
    const toggleCpu = (upper: number, n: number) => ({
      n,
      metrics: {
        cpuRelative: { n, median: upper / 2, iqr: 0, ci95: { lower: 0, upper } },
      },
    });
    const overheads = [
      overhead({
        n: 0,
        cpu: [0, 0, 0],
        memMiB: [30, 40, 50],
        cpuVerdictSource: "toggle",
        memVerdictSource: "notMeasured",
        toggle: toggleCpu(0.01, 16),
      }),
      overhead({
        scenarioId: "pointcloud",
        n: 3,
        cpu: [0.02, 0.04, 0.06],
        memMiB: [1, 2, 3],
        cpuVerdictSource: "toggle",
        memVerdictSource: "relaunch",
        toggle: toggleCpu(0.015, 8),
      }),
    ];

    // When
    const result = aggregateOverhead(overheads, "electron");

    // Then: the toggle CPU wins, the toggle-only memory is ignored, pairs come from the sources
    expect(result).toMatchObject({
      reports: 2,
      minPairs: 3,
      totalPairs: 24,
      cpuVerdictSources: { toggle: 2, relaunch: 0 },
      memNotMeasuredReports: 1,
      worstCpuRelative: { scenarioId: "pointcloud", ciUpper: 0.015, median: 0.0075 },
      worstMemMiB: { scenarioId: "pointcloud", ciUpper: 3, median: 2 },
    });
  });

  it("should leave the memory worst case out when no report measured memory", () => {
    // Given a toggle-only report
    const report = overhead({
      n: 0,
      cpuVerdictSource: "toggle",
      memVerdictSource: "notMeasured",
      toggle: { n: 5, metrics: { cpuRelative: { n: 5, median: 0, ci95: { lower: 0, upper: 0 } } } },
    });

    // When
    const result = aggregateOverhead([report], "electron");

    // Then
    expect(result?.worstMemMiB).toBeUndefined();
    expect(result?.minPairs).toBe(5);
  });

  it("should omit the overhead without reports of the platform", () => {
    // Given / When / Then
    expect(aggregateOverhead([overhead({ platform: "web" })], "electron")).toBeUndefined();
  });
});

describe("groupKpis", () => {
  it("should report each group's primary and secondary KPIs in group order", () => {
    // Given 3D, ingest and preloading runs, and one run without run.scenario
    const runs = [
      RunKpisBuilder.run({
        runId: "run-0",
        scenarioId: "pointcloud",
        scenario: { group: "3d-rendering" },
        kpis: {
          smoothness: { onTimeFramePercent: 37 },
          renderCost: { p90RenderMsByPanelType: { "3D": 600 } },
          memory: { peakTotalWorkingSetMiB: 900 },
        },
      }),
      RunKpisBuilder.run({
        runId: "run-1",
        scenarioId: "mcap-multi-ingest",
        scenario: { group: "real-pipeline-ingest" },
        kpis: { cpu: { cpuSecondsPerMiB: 0.5 }, throughput: { ingestMiBPerSec: 4 } },
        summary: {
          hydratedSourcePool: {
            pools: {
              "renderer/a": pool({ evictions: 2, rehydrations: 1 }),
              "renderer/b": pool({ evictions: 3, invariantHolds: false }),
            },
          },
        },
      }),
      RunKpisBuilder.run({
        runId: "run-2",
        scenarioId: "transformpreloading",
        scenario: { group: "preloading" },
        summary: {
          phases: { preloadDurationMs: 1500 },
          pipeline: { blockCachePeakBytes: 64 * MIB },
        },
      }),
      RunKpisBuilder.run({ runId: "run-3", scenarioId: "old", scenario: false }),
    ];

    // When
    const groups = groupKpis(runs, "electron");

    // Then
    expect(groups.map((group) => group.group)).toEqual([
      "3d-rendering",
      "preloading",
      "real-pipeline-ingest",
    ]);
    const [rendering, preloading, ingest] = groups;
    expect(rendering).toMatchObject({
      scenarios: ["pointcloud"],
      runs: 1,
      primary: { value: 37, n: 1, worst: { runId: "run-0" } },
    });
    expect(rendering!.secondary.map((kpi) => kpi.value)).toEqual([600, expect.closeTo(900, 6)]);
    expect(preloading!.primary).toMatchObject({ value: 1500, n: 1 });
    expect(preloading!.secondary[0]).toMatchObject({ value: 64 });
    expect(ingest!.primary).toMatchObject({ value: 0.5, n: 1 });
    expect(ingest!.secondary.map((kpi) => kpi.value)).toEqual([4, 5, 1, 1]);
  });

  it("should fall back to the listener dispatch p90 without Plot render telemetry", () => {
    // Given a time-series run (Plot emits no render metrics)
    const runs = [
      RunKpisBuilder.run({
        runId: "run-0",
        summary: { listenerDispatchDurationMs: { count: 10, p50: 1, p90: 2.5, max: 4 } },
      }),
    ];

    // When
    const [timeSeries] = groupKpis(runs, "electron");

    // Then
    expect(timeSeries!.primary).toMatchObject({
      value: 2.5,
      n: 1,
      fallbackFor: "Plot p90 render",
      def: { key: "listenerDispatchP90Ms" },
    });
  });
});
