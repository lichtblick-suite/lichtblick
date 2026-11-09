// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Telemetry overhead A/B report types (`overhead-<platform>-<scenario>-<ts>.json`). Type-only: also
// read by the report and the CI summary (`report/`, `result/kpis.ts`).

import type { OverheadToggleSummaryV3, ToggleConfigV3 } from "./toggleBlocks.types";
import type { DirectAttributionV3 } from "../result/directAttribution.types";
import type { BenchmarkPlatform } from "../result/schemaV1";
import type { MetricStats, Verdict } from "../result/stats.types";
import type { MainThreadRatesV1, SteadyWindowSummaryV1 } from "../result/steadyWindow.types";
import type { CollectorsStateV1, TelemetrySelfSummaryV1 } from "../result/telemetrySelf.types";

export type OverheadTargets = { cpuDeltaRelativeMax: number; memDeltaBytesMax: number };

/**
 * One arm of the A/B: telemetry `off` (`?telemetry=off`), `on`, or `on-noUa` (telemetry on with the
 * UA-specific memory probe off, `?telemetry.uaMemory=off`; web only, `BENCHMARK_OVERHEAD_UA_ARM=1`).
 */
export type OverheadArm = "off" | "on" | "on-noUa";

/** `<treatment>-vs-<base>`: what a pair's deltas compare (treatment − base). */
export type OverheadComparison = "on-vs-off" | "onNoUa-vs-off" | "on-vs-onNoUa";

/**
 * How the overhead is measured (`BENCHMARK_OVERHEAD_METHOD`): `toggle` = one launch, telemetry
 * switched off/on in-process (CPU only), `relaunch` = a fresh launch per arm and repeat (CPU and
 * memory), `both` = CPU verdict from toggle, memory verdict from relaunch.
 */
export type OverheadMethod = "toggle" | "relaunch" | "both";

/** Which measurement a verdict comes from (`notMeasured`: memory with method `toggle`). */
export type OverheadVerdictSource = "toggle" | "relaunch" | "notMeasured";

/** Overhead env knobs (`parseOverheadConfig`). */
export type OverheadEnvConfig = {
  /** `BENCHMARK_OVERHEAD_METHOD` (default `both`). */
  method: OverheadMethod;
  /** Measured runs per arm (`BENCHMARK_OVERHEAD_REPEATS`, default 5, min 1). */
  repeats: number;
  /** Discarded runs before the measured ones (`BENCHMARK_OVERHEAD_WARMUP_RUNS`, default 1). */
  warmupRuns: number;
  /** Steady polls per run (`BENCHMARK_OVERHEAD_POLLS`, default 10, min 5). */
  polls: number;
  /**
   * `BENCHMARK_OVERHEAD_UA_ARM=1` (web only): adds the relaunch `on-noUa` arm and, with the toggle
   * A/B, a second toggle launch without the UA memory probe (`toggleWithoutUaProbe`).
   */
  uaArm: boolean;
  /** Fails the test on an overall `exceeds` verdict (`BENCHMARK_OVERHEAD_GATE=1`). */
  gate: boolean;
  /** Toggle ABBA quartets of 4 blocks (`BENCHMARK_OVERHEAD_TOGGLE_QUARTETS`, default 10, min 4). */
  toggleQuartets: number;
  /** Toggle block length incl. settle (`BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS`, default 3000, min 1000). */
  toggleBlockMs: number;
  /**
   * Profiled period of the direct CPU attribution after the toggle blocks, telemetry on
   * (`BENCHMARK_OVERHEAD_PROFILE_MS`, default 10000, 0 disables).
   */
  profileMs: number;
  /**
   * `BENCHMARK_OVERHEAD_FRAME_PROBE_ARM=1`, with the toggle A/B only: one more toggle launch with
   * telemetry off that toggles only the benchmark FPS probe's frame loop (`toggleFrameProbe`,
   * informational: harness, not shipped).
   */
  frameProbeArm: boolean;
};

/** One scheduled run (`buildOverheadSchedule`). */
export type ScheduledOverheadRun = {
  arm: OverheadArm;
  /** Discarded warm-up run (fresh instance, not in the report's pairs). */
  warmup: boolean;
  /** Measured repeat index (0-based); -1 for warm-up runs. */
  repeat: number;
  /** Position within its repeat (0-based); warm-up runs: index among the warm-ups. */
  order: number;
  /** Position in the whole schedule (0-based, warm-ups first). */
  sequence: number;
};

/** Steady-window host statistics of one run (`summary.steadyWindow` without the probe rates). */
export type OverheadRunStatsV2 = Omit<SteadyWindowSummaryV1, "mainThread">;

/** One measured run of the report. */
export type OverheadRunV2 = {
  arm: OverheadArm;
  repeat: number;
  order: number;
  sequence: number;
  telemetryEnabled: boolean;
  steady: OverheadRunStatsV2;
  mainThread?: MainThreadRatesV1;
  /** Telemetry-on arms only. */
  telemetrySelf?: TelemetrySelfSummaryV1;
  collectors?: CollectorsStateV1;
  /** File name of the run's v1 result (in the same artifacts directory). */
  resultFile?: string;
};

/** Per-pair deltas (treatment − base). */
export type OverheadPairDeltas = {
  /** `(treatment − base) / base` of the steady median total CPU; undefined for a 0 baseline. */
  cpuRelative?: number;
  /** Treatment − base steady median total CPU, percentage points (100 = one core). */
  cpuPctPoints: number;
  /**
   * Treatment − base steady mean total working set, bytes; absent when either run measured no
   * working set (memory not measured).
   */
  memBytes?: number;
  /** As `memBytes`, over the process types both runs had (secondary, see `processSetMismatch`). */
  memBytesCommonProcesses?: number;
  /** Main-thread probe deltas (absent when a run lacks the probe reading). */
  mainThreadBlockedMsPerSec?: number;
  fps?: number;
};

export type OverheadExclusionReason = "baseWindowMismatch" | "treatmentWindowMismatch";

/** `processSetMismatch`: the runs had different process types or counts (flagged, not excluded). */
export type OverheadPairFlag = "processSetMismatch";

export type OverheadPair = {
  comparison: OverheadComparison;
  repeat: number;
  /**
   * Run order within the repeat: `off-first` = the base arm (off, or `on-noUa` for
   * `on-vs-onNoUa`) ran before the treatment arm; `on-first` = the treatment ran first.
   */
  order: "off-first" | "on-first";
  baseArm: OverheadArm;
  treatmentArm: OverheadArm;
  deltas: OverheadPairDeltas;
  /** Excluded from the statistics (see `reasons`). */
  excluded: boolean;
  reasons: OverheadExclusionReason[];
  flags: OverheadPairFlag[];
};

export type OverheadMetricKey = keyof Required<OverheadPairDeltas>;

/** Median, IQR and exact order-statistic CI95 of each delta over the included pairs. */
export type OverheadMetrics = Record<OverheadMetricKey, MetricStats>;

/** Tri-state checks of the CI95 against the targets; `overall` = the worst of cpu and memory. */
export type OverheadVerdicts = { cpu: Verdict; memory: Verdict; overall: Verdict };

/** Statistics of one comparison over its pairs. */
export type OverheadComparisonSummary = {
  /** Included pairs. */
  n: number;
  excludedPairs: number;
  /** Included pairs flagged `processSetMismatch`. */
  processSetMismatches: number;
  metrics: OverheadMetrics;
};

/** Medians of the telemetry-on (`on` arm) runs' `telemetrySelf`. */
export type OverheadSelfCostSummary = {
  n: number;
  msPerSec: number;
  fractionOfCore: number;
  recordsPerSec: number;
  meanEmitNs?: number;
  estimatedEmitMsPerSec?: number;
  /** UA memory probe (whole run, see `TelemetrySelfSummaryV1`). */
  uaCalls: number;
  uaResolved?: number;
  uaFailures?: number;
  /** Median of the runs' mean call → resolve latency of resolved calls (wall clock, ms). */
  uaResolveMsMean?: number;
};

export type OverheadConfigV2 = {
  repeats: number;
  warmupRuns: number;
  arms: OverheadArm[];
  warmupMs: number;
  polls: number;
  sampleIntervalMs: number;
};

/** The current overhead report schema. */
export type OverheadReport = OverheadReportV3;

/**
 * Final verdicts of a schema-3 report: `cpu` from `cpuVerdictSource`, `memory` from the relaunch
 * A/B (absent when `memVerdictSource` is `notMeasured`), `overall` = the worst measured one.
 */
export type OverheadVerdictsV3 = { cpu: Verdict; memory?: Verdict; overall: Verdict };

export type OverheadConfigV3 = OverheadConfigV2 & {
  method: OverheadMethod;
  /** Toggle A/B settings (methods `toggle` / `both`). */
  toggle?: ToggleConfigV3;
};

/**
 * Overhead report, schema 3: the relaunch A/B (repeated, order-balanced runs of telemetry off vs on,
 * and optionally on without the UA memory probe; their pair deltas and statistics), the
 * in-process toggle A/B (`toggle`) and where each verdict comes from. The relaunch fields (`runs`,
 * `pairs`, `n`, `metrics`, …) are empty with `n = 0` for method `toggle`; `relaunchVerdicts` are
 * their own verdicts, `verdicts` the final ones (CPU from `cpuVerdictSource`, memory from
 * `memVerdictSource`).
 */
export type OverheadReportV3 = {
  schemaVersion: 3;
  kind: "overhead";
  platform: BenchmarkPlatform;
  scenarioId: string;
  createdAtWall: string;
  method: OverheadMethod;
  config: OverheadConfigV3;
  runs: OverheadRunV2[];
  pairs: OverheadPair[];
  /** Relaunch `on-vs-off` statistics (the gated comparison). */
  n: number;
  excludedPairs: number;
  processSetMismatches: number;
  /** Measured runs with `steady.windowMismatch`. */
  windowMismatchRuns: number;
  metrics: OverheadMetrics;
  verdicts: OverheadVerdictsV3;
  /** `onNoUa-vs-off`: telemetry without the UA memory probe (UA arm only). */
  withoutUaProbe?: OverheadComparisonSummary & { verdicts: OverheadVerdicts };
  /** `on-vs-onNoUa`: what the UA memory probe alone costs (UA arm only, no verdict). */
  uaCost?: OverheadComparisonSummary;
  /** In-page self-cost of the `on` arm (absent when no `on` run carries `telemetrySelf`). */
  selfCost?: OverheadSelfCostSummary;
  targets: OverheadTargets;
  cpuVerdictSource: Exclude<OverheadVerdictSource, "notMeasured">;
  memVerdictSource: Exclude<OverheadVerdictSource, "toggle">;
  /** Verdicts of the relaunch A/B alone (absent for method `toggle`). */
  relaunchVerdicts?: OverheadVerdicts;
  /** The toggle A/B (methods `toggle` / `both`). */
  toggle?: OverheadToggleSummaryV3;
  /**
   * The toggle A/B of a second launch with the UA memory probe off (`?telemetry.uaMemory=off`; web,
   * `BENCHMARK_OVERHEAD_UA_ARM=1`, methods `toggle` / `both`). Informational: isolates the probe's
   * share of `toggle`; the CPU verdict stays the one of `toggle`.
   */
  toggleWithoutUaProbe?: OverheadToggleSummaryV3;
  /**
   * Benchmark FPS probe (harness, not shipped): a launch with telemetry off in both arms whose
   * blocks toggle only the bare rAF frame loop (`BENCHMARK_OVERHEAD_FRAME_PROBE_ARM=1`, methods
   * `toggle` / `both`). Informational: what the frame loop alone costs; never part of `verdicts`.
   */
  toggleFrameProbe?: OverheadToggleSummaryV3;
  /**
   * Direct (JS only) CPU attribution of the toggle launch: a profiled period with telemetry on
   * after the blocks (`BENCHMARK_OVERHEAD_PROFILE_MS`). Its own verdict, never merged into
   * `verdicts` (the CPU verdict stays the statistical one of `cpuVerdictSource`).
   */
  directAttribution?: DirectAttributionV3;
};

/** Inputs of `buildOverheadReport`. */
export type OverheadRunInput = Omit<
  OverheadRunV2,
  "steady" | "mainThread" | "telemetrySelf" | "collectors" | "telemetryEnabled"
> & {
  /** The run's v1 result (must carry `summary.steadyWindow`). */
  result: {
    run: {
      telemetryEnabled: boolean;
      environment: { collectors?: CollectorsStateV1 };
    };
    summary: { steadyWindow?: SteadyWindowSummaryV1; telemetrySelf?: TelemetrySelfSummaryV1 };
  };
};

export type BuildOverheadReportInput = {
  platform: BenchmarkPlatform;
  scenarioId: string;
  /** Default `relaunch`. */
  method?: OverheadMethod;
  /** Relaunch A/B runs (none for method `toggle`). */
  runs: readonly OverheadRunInput[];
  config: OverheadConfigV2;
  /** Toggle A/B of the scenario (required for methods `toggle` / `both`). */
  toggle?: OverheadToggleSummaryV3;
  /** Toggle A/B of a second launch without the UA memory probe (`toggleWithoutUaProbe`). */
  toggleWithoutUaProbe?: OverheadToggleSummaryV3;
  /** Toggle A/B of the bare frame loop with telemetry off (`toggleFrameProbe`, kept only with `toggle`). */
  toggleFrameProbe?: OverheadToggleSummaryV3;
  /** Direct CPU attribution of the toggle launch (kept only with `toggle`). */
  directAttribution?: DirectAttributionV3;
  targets?: OverheadTargets;
  now?: Date;
};
