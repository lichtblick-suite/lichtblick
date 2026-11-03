// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// KPIs of benchmark results: per run (`computeRunKpis`, stored as `summary.kpis`), per platform
// (`aggregateKpis`, the report's scorecard) and per scenario group (`groupKpis`).
// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too). Imports only types from
// `schemaV1` (which calls `computeRunKpis`).

import {
  BYTES_PER_MIB,
  GROUP_KPIS,
  LOW_FPS_WARNING,
  MS_PER_SECOND,
  PANEL_TYPE_3D,
  PANEL_TYPE_PLOT,
  RENDER_COST_POLICY,
  SCORECARD_POLICIES,
} from "./constants";
import type {
  GroupKpisV1,
  GroupKpiValueV1,
  GroupMetricDef,
  GroupMetricKey,
  KpiAggregateV1,
  KpiPolicy,
  KpiRun,
  KpiRunRef,
  OverheadAggregateV1,
  OverheadKpiInput,
  OverheadWorstV1,
  PlatformScorecardV1,
  RunKpisInput,
  RunKpisV1,
  ScorecardMetricKey,
} from "./kpis.types";
import { geometricMean } from "./numeric";
import type { BenchmarkPlatform, PersistedResultV1, StoredResultV1, SummaryV1 } from "./schemaV1";
import { worstVerdict } from "./stats";
import type { MetricStats } from "./stats.types";
import { SCENARIO_GROUPS } from "../../src/scenarios/constants";
import { compareCodeUnits } from "../shared/compare";

type Summary = Omit<SummaryV1, "kpis">;

// ---------------------------------------------------------------------------------------------
// Per run
// ---------------------------------------------------------------------------------------------

/** Why a run is not healthy (see `RunKpisV1.stability`). */
function unhealthyReasons(input: RunKpisInput): string[] {
  const reasons: string[] = [];
  for (const [type, count] of Object.entries(input.summary.runnerEvents ?? {})) {
    if (count > 0) {
      reasons.push(`${type} ×${count}`);
    }
  }
  const pools = input.summary.hydratedSourcePool?.pools ?? {};
  for (const [key, pool] of Object.entries(pools)) {
    if (!pool.invariantHolds) {
      reasons.push(`pool invariant violated (${key})`);
    }
  }
  const dropped = Object.values(input.dropped).reduce((sum, count) => sum + count, 0);
  if (dropped > 0) {
    reasons.push(`${dropped} telemetry records dropped`);
  }
  return reasons;
}

function ratio(numerator: number | undefined, denominator: number | undefined): number | undefined {
  if (numerator == undefined || denominator == undefined || denominator <= 0) {
    return undefined;
  }
  return numerator / denominator;
}

function percentOf(part: number | undefined, whole: number | undefined): number | undefined {
  const value = ratio(part, whole);
  return value == undefined ? undefined : value * 100;
}

function cpuKpis(input: RunKpisInput): RunKpisV1["cpu"] {
  const { process, pipeline } = input.summary;
  const { run } = input;
  const windowSec =
    ((run.windowEndMonotonicTs ?? run.endMonotonicTs) - run.startMonotonicTs) / 1000;
  const ingestedMiB =
    pipeline?.bytesPerSec == undefined
      ? undefined
      : (pipeline.bytesPerSec * windowSec) / BYTES_PER_MIB;
  return {
    medianCpuPercent: process.sampleCount > 0 ? process.medianTotalCpuPercent : undefined,
    cpuSeconds: process.cpuSeconds,
    cpuSecondsPerMiB: ratio(process.cpuSeconds, ingestedMiB),
  };
}

function smoothnessKpis(input: RunKpisInput): RunKpisV1["smoothness"] {
  const { renderer } = input.summary;
  const { run } = input;
  const fpsCeiling =
    run.environment.fpsCeiling != undefined && run.environment.fpsCeiling > 0
      ? run.environment.fpsCeiling
      : undefined;
  const lateShare = ratio(renderer.lateFrames, renderer.totalFrames);
  const runSec = (run.endMonotonicTs - run.startMonotonicTs) / MS_PER_SECOND;
  return {
    medianFps: renderer.medianFps,
    fpsCeiling,
    fpsPercentOfCeiling: percentOf(renderer.medianFps, fpsCeiling),
    onTimeFramePercent: lateShare == undefined ? undefined : (1 - lateShare) * 100,
    longTaskBlockedMsPerSec: ratio(renderer.longTaskTotalMs, runSec),
    lowFps: renderer.medianFps != undefined && renderer.medianFps < LOW_FPS_WARNING,
  };
}

function renderCostKpis(summary: Summary): RunKpisV1["renderCost"] {
  const byType: Record<string, number> = {};
  let worst: { id: string; type: string; ms: number } | undefined;
  const panels = Object.entries(summary.panels ?? {}).sort(([a], [b]) => compareCodeUnits(a, b));
  for (const [id, panel] of panels) {
    const ms = panel.renderP90WindowMaxMs;
    if (ms == undefined) {
      continue;
    }
    byType[panel.panelType] = Math.max(byType[panel.panelType] ?? ms, ms);
    if (worst == undefined || ms > worst.ms) {
      worst = { id, type: panel.panelType, ms };
    }
  }
  return {
    worstPanelP90RenderMs: worst?.ms,
    worstPanelId: worst?.id,
    worstPanelType: worst?.type,
    p90RenderMsByPanelType: byType,
  };
}

/** Per-run KPI families of a result (`summary.kpis`, see `RunKpisV1`). */
export function computeRunKpis(input: RunKpisInput): RunKpisV1 {
  const { summary } = input;
  const reasons = unhealthyReasons(input);
  return {
    stability: { healthy: reasons.length === 0, reasons },
    memory: {
      peakTotalWorkingSetMiB:
        summary.process.sampleCount > 0
          ? summary.process.peakTotalWorkingSetBytes / BYTES_PER_MIB
          : undefined,
      workingSetSlopeMiBPerMin: summary.process.totalWorkingSetSlopeMiBPerMin,
    },
    cpu: cpuKpis(input),
    smoothness: smoothnessKpis(input),
    startup: {
      panelsReadyMs: summary.phases.panelsReadyMs,
      firstMessageMs: summary.phases.firstMessageMs,
    },
    throughput: {
      ingestMiBPerSec:
        summary.pipeline?.bytesPerSec == undefined
          ? undefined
          : summary.pipeline.bytesPerSec / BYTES_PER_MIB,
      messagesPerSec: summary.pipeline?.messagesPerSec,
      fanout: summary.pipeline?.deliveredFanout,
    },
    renderCost: renderCostKpis(summary),
  };
}

/**
 * A stored result with `summary.kpis`: unchanged when present, else backfilled with
 * `computeRunKpis` and marked `recomputed` (results written before `summary.kpis` existed).
 */
export function withRunKpis(result: StoredResultV1): PersistedResultV1 {
  if (result.summary.kpis != undefined) {
    return {
      ...result,
      summary: { ...result.summary, kpis: result.summary.kpis },
    };
  }
  const kpis = { ...computeRunKpis(result), recomputed: true };
  return { ...result, summary: { ...result.summary, kpis } };
}

// ---------------------------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------------------------

type RunValue = { ref: KpiRunRef; value: number };

function refOf(run: KpiRun): KpiRunRef {
  return { scenarioId: run.result.run.scenarioId, runId: run.runId };
}

/** First entry with the highest (`max`) or lowest (`min`) value. */
function pickWorst<T extends { value: number }>(
  values: readonly T[],
  worst: KpiPolicy["worst"],
): T | undefined {
  const sign = worst === "max" ? 1 : -1;
  let picked: T | undefined;
  for (const entry of values) {
    if (picked == undefined || sign * (entry.value - picked.value) > 0) {
      picked = entry;
    }
  }
  return picked;
}

function combine(values: readonly number[], policy: KpiPolicy): { value?: number; n: number } {
  switch (policy.aggregate) {
    case "geomean":
      return geometricMean(values);
    case "sum":
      return { value: values.reduce((sum, value) => sum + value, 0), n: values.length };
    case "min":
      return { value: Math.min(...values), n: values.length };
    case "max":
      return { value: Math.max(...values), n: values.length };
  }
}

/** Aggregates per-run values (undefined/non-finite ignored) with `policy`. */
export function aggregateValues(
  values: ReadonlyArray<{ ref: KpiRunRef; value: number | undefined }>,
  policy: KpiPolicy,
): KpiAggregateV1 {
  const usable = values.filter((entry): entry is RunValue => Number.isFinite(entry.value));
  if (usable.length === 0) {
    return { n: 0 };
  }
  const combined = combine(
    usable.map((entry) => entry.value),
    policy,
  );
  const worst = pickWorst(usable, policy.worst);
  return {
    ...combined,
    ...(worst == undefined ? {} : { worst: { ...worst.ref, value: worst.value } }),
  };
}

const SCORECARD_VALUE: Readonly<
  Record<ScorecardMetricKey, (kpis: RunKpisV1) => number | undefined>
> = {
  peakTotalWorkingSetMiB: (kpis) => kpis.memory.peakTotalWorkingSetMiB,
  workingSetSlopeMiBPerMin: (kpis) => kpis.memory.workingSetSlopeMiBPerMin,
  medianCpuPercent: (kpis) => kpis.cpu.medianCpuPercent,
  cpuSecondsPerMiB: (kpis) => kpis.cpu.cpuSecondsPerMiB,
  medianFps: (kpis) => kpis.smoothness.medianFps,
  fpsPercentOfCeiling: (kpis) => kpis.smoothness.fpsPercentOfCeiling,
  onTimeFramePercent: (kpis) => kpis.smoothness.onTimeFramePercent,
  longTaskBlockedMsPerSec: (kpis) => kpis.smoothness.longTaskBlockedMsPerSec,
  panelsReadyMs: (kpis) => kpis.startup.panelsReadyMs,
  firstMessageMs: (kpis) => kpis.startup.firstMessageMs,
  ingestMiBPerSec: (kpis) => kpis.throughput.ingestMiBPerSec,
};

/** Telemetry-on runs of `platform` (the scorecard never mixes platforms). */
function runsOf(runs: readonly KpiRun[], platform: BenchmarkPlatform): KpiRun[] {
  return runs.filter(
    (run) => run.result.run.platform === platform && run.result.run.telemetryEnabled,
  );
}

function renderCostByPanelType(runs: readonly KpiRun[]): Record<string, KpiAggregateV1> {
  const byType = new Map<string, RunValue[]>();
  for (const run of runs) {
    const perType = run.result.summary.kpis.renderCost.p90RenderMsByPanelType;
    for (const [type, value] of Object.entries(perType)) {
      const list = byType.get(type) ?? [];
      list.push({ ref: refOf(run), value });
      byType.set(type, list);
    }
  }
  const types = [...byType.keys()].sort(compareCodeUnits);
  return Object.fromEntries(
    types.map((type) => [type, aggregateValues(byType.get(type)!, RENDER_COST_POLICY)]),
  );
}

/** Latest report per scenario of `platform`, sorted by scenario. */
function latestOverheadReports(
  overheads: readonly OverheadKpiInput[],
  platform: BenchmarkPlatform,
): OverheadKpiInput[] {
  const latest = new Map<string, OverheadKpiInput>();
  for (const report of overheads) {
    const previous = latest.get(report.scenarioId);
    const newer =
      previous == undefined || compareCodeUnits(report.createdAtWall, previous.createdAtWall) > 0;
    if (report.platform === platform && newer) {
      latest.set(report.scenarioId, report);
    }
  }
  return [...latest.values()].sort((a, b) => compareCodeUnits(a.scenarioId, b.scenarioId));
}

/** Scenario with the highest CI95 upper bound of a metric (median when no CI), scaled. */
function worstOverhead(
  reports: readonly OverheadKpiInput[],
  stats: (report: OverheadKpiInput) => MetricStats,
  scale: number,
): OverheadWorstV1 | undefined {
  const candidates = reports.flatMap((report) => {
    const { ci95, median: metricMedian } = stats(report);
    const upper = ci95?.upper ?? metricMedian;
    if (upper == undefined) {
      return [];
    }
    return [
      {
        scenarioId: report.scenarioId,
        value: upper / scale,
        ...(metricMedian != undefined && { median: metricMedian / scale }),
      },
    ];
  });
  const worst = pickWorst(candidates, "max");
  if (worst == undefined) {
    return undefined;
  }
  return {
    scenarioId: worst.scenarioId,
    ciUpper: worst.value,
    ...(worst.median != undefined && { median: worst.median }),
  };
}

/** The CPU verdict's source of a report (`relaunch` before schema 3). */
function cpuSourceOf(report: OverheadKpiInput): "toggle" | "relaunch" {
  return report.cpuVerdictSource ?? "relaunch";
}

/** Whether a report has a memory verdict (not with method `toggle`). */
function memMeasured(report: OverheadKpiInput): boolean {
  return report.memVerdictSource !== "notMeasured";
}

/** Relative CPU delta statistics and unit count (toggle quartets / relaunch pairs) behind a report's CPU verdict. */
function cpuVerdictStats(report: OverheadKpiInput): {
  n: number;
  stats: MetricStats;
} {
  if (cpuSourceOf(report) === "toggle") {
    return report.toggle != undefined
      ? { n: report.toggle.n, stats: report.toggle.metrics.cpuRelative }
      : { n: 0, stats: { n: 0 } };
  }
  return { n: report.n, stats: report.metrics.cpuRelative };
}

/** Smallest unit count (quartets / pairs) behind a report's verdicts (CPU, and memory when measured). */
function verdictPairs(report: OverheadKpiInput): number {
  const cpuPairs = cpuVerdictStats(report).n;
  return memMeasured(report) ? Math.min(cpuPairs, report.n) : cpuPairs;
}

/**
 * Overhead of `platform` from the latest report per scenario: the worst verdict, pair counts and
 * the scenarios with the highest CPU / memory CI95 upper bound against the targets. CPU comes from
 * each report's CPU verdict source (toggle or relaunch), memory from the relaunch A/B of the
 * reports that measured it.
 */
export function aggregateOverhead(
  overheads: readonly OverheadKpiInput[],
  platform: BenchmarkPlatform,
): OverheadAggregateV1 | undefined {
  const reports = latestOverheadReports(overheads, platform);
  const first = reports[0];
  if (first == undefined) {
    return undefined;
  }
  const cpu = worstOverhead(reports, (report) => cpuVerdictStats(report).stats, 1);
  const mem = worstOverhead(
    reports.filter(memMeasured),
    (report) => report.metrics.memBytes,
    BYTES_PER_MIB,
  );
  const toggleSourced = reports.filter((report) => cpuSourceOf(report) === "toggle").length;
  return {
    reports: reports.length,
    verdict: worstVerdict(reports.map((report) => report.verdicts.overall)),
    minPairs: Math.min(...reports.map(verdictPairs)),
    totalPairs: reports.reduce((sum, report) => sum + cpuVerdictStats(report).n, 0),
    cpuVerdictSources: { toggle: toggleSourced, relaunch: reports.length - toggleSourced },
    memNotMeasuredReports: reports.filter((report) => !memMeasured(report)).length,
    legacyReports: reports.filter((report) => report.legacy === true).length,
    ...(cpu != undefined && { worstCpuRelative: cpu }),
    ...(mem != undefined && { worstMemMiB: mem }),
    targets: {
      cpuDeltaRelativeMax: first.targets.cpuDeltaRelativeMax,
      memDeltaMiBMax: first.targets.memDeltaBytesMax / BYTES_PER_MIB,
    },
  };
}

/**
 * Scorecard of one platform: every KPI family aggregated over the platform's telemetry-on runs with
 * `SCORECARD_POLICIES`, plus the overhead worst case (`overheads`: A/B reports, any platform).
 */
export function aggregateKpis(
  runs: readonly KpiRun[],
  platform: BenchmarkPlatform,
  overheads: readonly OverheadKpiInput[] = [],
): PlatformScorecardV1 {
  const platformRuns = runsOf(runs, platform);
  const metrics = Object.fromEntries(
    Object.entries(SCORECARD_VALUE).map(([key, read]) => [
      key,
      aggregateValues(
        platformRuns.map((run) => ({ ref: refOf(run), value: read(run.result.summary.kpis) })),
        SCORECARD_POLICIES[key as ScorecardMetricKey],
      ),
    ]),
  ) as Record<ScorecardMetricKey, KpiAggregateV1>;
  const unhealthy = platformRuns.filter((run) => !run.result.summary.kpis.stability.healthy);
  const lowFpsRuns = platformRuns.flatMap((run) => {
    const { lowFps, medianFps } = run.result.summary.kpis.smoothness;
    return lowFps && medianFps != undefined ? [{ ...refOf(run), medianFps }] : [];
  });
  const overhead = aggregateOverhead(overheads, platform);
  return {
    platform,
    runs: platformRuns.length,
    stability: {
      healthy: platformRuns.length - unhealthy.length,
      total: platformRuns.length,
      unhealthy: unhealthy.map(refOf),
    },
    metrics,
    renderCostByPanelType: renderCostByPanelType(platformRuns),
    lowFpsRuns,
    ...(overhead == undefined ? {} : { overhead }),
  };
}

// ---------------------------------------------------------------------------------------------
// Scenario groups
// ---------------------------------------------------------------------------------------------

function poolTotals(
  summary: SummaryV1,
): { evictions: number; rehydrations: number; violations: number } | undefined {
  const pools = Object.values(summary.hydratedSourcePool?.pools ?? {});
  if (pools.length === 0) {
    return undefined;
  }
  return {
    evictions: pools.reduce((sum, pool) => sum + pool.evictions, 0),
    rehydrations: pools.reduce((sum, pool) => sum + pool.rehydrations, 0),
    violations: pools.filter((pool) => !pool.invariantHolds).length,
  };
}

function p90RenderOf(kpis: RunKpisV1, panelType: string): number | undefined {
  return kpis.renderCost.p90RenderMsByPanelType[panelType];
}

const GROUP_VALUE: Readonly<Record<GroupMetricKey, (summary: SummaryV1) => number | undefined>> = {
  onTimeFramePercent: (summary) => summary.kpis.smoothness.onTimeFramePercent,
  p90Render3dMs: (summary) => p90RenderOf(summary.kpis, PANEL_TYPE_3D),
  peakTotalWorkingSetMiB: (summary) => summary.kpis.memory.peakTotalWorkingSetMiB,
  p90RenderPlotMs: (summary) => p90RenderOf(summary.kpis, PANEL_TYPE_PLOT),
  listenerDispatchP90Ms: (summary) =>
    summary.listenerDispatchDurationMs?.p90 ?? summary.pipeline?.listenerDispatchP90WindowMaxMs,
  messagesPerSec: (summary) => summary.kpis.throughput.messagesPerSec,
  medianCpuPercent: (summary) => summary.kpis.cpu.medianCpuPercent,
  preloadDurationMs: (summary) => summary.phases.preloadDurationMs,
  blockCachePeakMiB: (summary) =>
    summary.pipeline?.blockCachePeakBytes == undefined
      ? undefined
      : summary.pipeline.blockCachePeakBytes / BYTES_PER_MIB,
  workingSetSlopeMiBPerMin: (summary) => summary.kpis.memory.workingSetSlopeMiBPerMin,
  cpuSecondsPerMiB: (summary) => summary.kpis.cpu.cpuSecondsPerMiB,
  ingestMiBPerSec: (summary) => summary.kpis.throughput.ingestMiBPerSec,
  poolEvictions: (summary) => poolTotals(summary)?.evictions,
  poolRehydrations: (summary) => poolTotals(summary)?.rehydrations,
  poolInvariantViolations: (summary) => poolTotals(summary)?.violations,
};

function groupValue(runs: readonly KpiRun[], def: GroupMetricDef): GroupKpiValueV1 {
  const read = GROUP_VALUE[def.key];
  return {
    def,
    ...aggregateValues(
      runs.map((run) => ({ ref: refOf(run), value: read(run.result.summary) })),
      def.policy,
    ),
  };
}

/** The primary KPI, or its `fallback` (labelled) when no run has a value for it. */
function primaryValue(runs: readonly KpiRun[], def: GroupMetricDef): GroupKpiValueV1 {
  const primary = groupValue(runs, def);
  if (primary.n > 0 || def.fallback == undefined) {
    return primary;
  }
  return {
    ...groupValue(runs, { ...def.fallback, policy: def.policy }),
    fallbackFor: def.label,
  };
}

/**
 * Per scenario group (`SCENARIO_GROUPS` order) of `platform`: the group's primary and secondary
 * KPIs (`GROUP_KPIS`) over its telemetry-on runs. Runs without `run.scenario` have no group and
 * are left out; groups without runs are omitted.
 */
export function groupKpis(runs: readonly KpiRun[], platform: BenchmarkPlatform): GroupKpisV1[] {
  const platformRuns = runsOf(runs, platform);
  return SCENARIO_GROUPS.flatMap((group) => {
    const groupRuns = platformRuns.filter((run) => run.result.run.scenario?.group === group);
    if (groupRuns.length === 0) {
      return [];
    }
    const defs = GROUP_KPIS[group];
    const scenarios = [...new Set(groupRuns.map((run) => run.result.run.scenarioId))].sort(
      compareCodeUnits,
    );
    return [
      {
        group,
        platform,
        scenarios,
        runs: groupRuns.length,
        primary: primaryValue(groupRuns, defs.primary),
        secondary: defs.secondary.map((def) => groupValue(groupRuns, def)),
      },
    ];
  });
}
