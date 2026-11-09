// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too).

import type {
  BenchmarkPlatform,
  PersistedRunInfoV1,
  RenderCalibrationV1,
  SummaryV1,
} from "./schemaV1";
import type { ScenarioGroup } from "../../src/scenarios/scenarioControl";

/**
 * `summary.kpis`: per-run KPI families derived from the other summaries (`computeRunKpis`). Every
 * value is omitted when its inputs are missing (e.g. no frames, no host polls, no pipeline bytes).
 */
export type RunKpisV1 = {
  /**
   * Set by readers that backfilled the KPIs of a result written before `summary.kpis` existed
   * (`withRunKpis`); never written by the runner.
   */
  recomputed?: boolean;
  stability: {
    /**
     * Passed (no crash / gone process / reload: `summary.runnerEvents` all 0, when recorded), every
     * `HydratedSourcePool` invariant held (or no pool) and no telemetry record was dropped. Runs that
     * hit an error boundary write no result.
     */
    healthy: boolean;
    /** Why the run is not healthy (empty when healthy). */
    reasons: string[];
  };
  memory: {
    /** `summary.process.peakTotalWorkingSetBytes` in MiB (omitted without host polls). */
    peakTotalWorkingSetMiB?: number;
    /** `summary.process.totalWorkingSetSlopeMiBPerMin` (steady window only, see there). */
    workingSetSlopeMiBPerMin?: number;
  };
  cpu: {
    /** `summary.process.medianTotalCpuPercent` (omitted without host polls or CPU readings). */
    medianCpuPercent?: number;
    /** `summary.process.cpuSeconds`. */
    cpuSeconds?: number;
    /**
     * CPU seconds per MiB the pipeline ingested over the measured window: `cpuSeconds` / (pipeline
     * `bytesPerSec` × window seconds / MiB). Omitted without ingested bytes.
     */
    cpuSecondsPerMiB?: number;
  };
  smoothness: {
    /** `summary.renderer.medianFps`: always reported when frames were collected (web included). */
    medianFps?: number;
    /** `run.environment.fpsCeiling` (refresh rate measured on a blank page; omitted when 0). */
    fpsCeiling?: number;
    /** `medianFps / fpsCeiling × 100`. */
    fpsPercentOfCeiling?: number;
    /** `(1 − lateFrames / totalFrames) × 100`. */
    onTimeFramePercent?: number;
    /** `longTaskTotalMs` / run seconds (`endMonotonicTs − startMonotonicTs`). */
    longTaskBlockedMsPerSec?: number;
    /** `medianFps < LOW_FPS_WARNING` (informational). */
    lowFps: boolean;
  };
  startup: {
    /** `summary.phases.panelsReadyMs`. */
    panelsReadyMs?: number;
    /** `summary.phases.firstMessageMs`. */
    firstMessageMs?: number;
  };
  throughput: {
    /** `summary.pipeline.bytesPerSec` in MiB/s (player → pipeline). */
    ingestMiBPerSec?: number;
    /** `summary.pipeline.messagesPerSec`. */
    messagesPerSec?: number;
    /** `summary.pipeline.deliveredFanout` (delivered / received). */
    fanout?: number;
  };
  renderCost: {
    /** Highest `renderP90WindowMaxMs` of the run's panels (adapter panels only). */
    worstPanelP90RenderMs?: number;
    worstPanelId?: string;
    worstPanelType?: string;
    /** Highest `renderP90WindowMaxMs` per panel type. */
    p90RenderMsByPanelType: Record<string, number>;
  };
};

/** The parts of a (stored) result `computeRunKpis` reads. */
export type RunKpisInput = {
  run: Pick<PersistedRunInfoV1, "startMonotonicTs" | "endMonotonicTs" | "windowEndMonotonicTs"> & {
    environment: Partial<Pick<RenderCalibrationV1, "fpsCeiling">>;
  };
  dropped: Readonly<Record<string, number>>;
  summary: Omit<SummaryV1, "kpis">;
};

/** How runs are combined into one value, and which run is the worst. */
export type KpiAggregation = "geomean" | "min" | "max" | "sum";
export type KpiPolicy = { readonly aggregate: KpiAggregation; readonly worst: "min" | "max" };

/** Scorecard metrics taken from `RunKpisV1` (see `SCORECARD_POLICIES`). */
export type ScorecardMetricKey =
  | "peakTotalWorkingSetMiB"
  | "workingSetSlopeMiBPerMin"
  | "medianCpuPercent"
  | "cpuSecondsPerMiB"
  | "medianFps"
  | "fpsPercentOfCeiling"
  | "onTimeFramePercent"
  | "longTaskBlockedMsPerSec"
  | "panelsReadyMs"
  | "firstMessageMs"
  | "ingestMiBPerSec";

/** A run as aggregated: `runId` is the caller's link target (e.g. the report's run anchor). */
export type KpiRun = {
  runId: string;
  result: {
    run: Pick<PersistedRunInfoV1, "scenarioId" | "platform" | "telemetryEnabled" | "scenario">;
    summary: SummaryV1;
  };
};

export type KpiRunRef = { scenarioId: string; runId: string };

/** One aggregated metric: `n` runs had a usable value; `worst` is the run to look at first. */
export type KpiAggregateV1 = {
  value?: number;
  n: number;
  worst?: KpiRunRef & { value: number };
};

/** Scorecard of one platform (`aggregateKpis`); electron and web are never mixed. */
export type PlatformScorecardV1 = {
  platform: BenchmarkPlatform;
  /** Telemetry-on runs of the platform. */
  runs: number;
  stability: { healthy: number; total: number; unhealthy: KpiRunRef[] };
  metrics: Record<ScorecardMetricKey, KpiAggregateV1>;
  /** Highest p90 render ms per panel type over the runs. */
  renderCostByPanelType: Record<string, KpiAggregateV1>;
  lowFpsRuns: Array<KpiRunRef & { medianFps: number }>;
};

/** Group KPI metrics (see `GROUP_KPIS`). */
export type GroupMetricKey =
  | "onTimeFramePercent"
  | "p90Render3dMs"
  | "peakTotalWorkingSetMiB"
  | "p90RenderPlotMs"
  | "listenerDispatchP90Ms"
  | "messagesPerSec"
  | "medianCpuPercent"
  | "preloadDurationMs"
  | "blockCachePeakMiB"
  | "workingSetSlopeMiBPerMin"
  | "cpuSecondsPerMiB"
  | "ingestMiBPerSec"
  | "poolEvictions"
  | "poolRehydrations"
  | "poolInvariantViolations";

export type GroupMetricDef = {
  readonly key: GroupMetricKey;
  readonly label: string;
  readonly unit: string;
  readonly digits: number;
  readonly policy: KpiPolicy;
  /** Used instead (same policy) when no run of the group has a value for `key`. */
  readonly fallback?: Omit<GroupMetricDef, "policy" | "fallback">;
};

export type GroupKpiDefs = {
  readonly primary: GroupMetricDef;
  readonly secondary: readonly GroupMetricDef[];
};

export type GroupKpiValueV1 = KpiAggregateV1 & {
  def: GroupMetricDef;
  /** Label of the primary metric replaced by its `fallback` (no run had a value for it). */
  fallbackFor?: string;
};

/** Per scenario group of one platform (`groupKpis`). */
export type GroupKpisV1 = {
  group: ScenarioGroup;
  platform: BenchmarkPlatform;
  /** Scenario ids of the group's runs, sorted. */
  scenarios: string[];
  runs: number;
  primary: GroupKpiValueV1;
  secondary: GroupKpiValueV1[];
};
