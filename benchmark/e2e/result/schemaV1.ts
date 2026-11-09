// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// `benchmark-result.v1.json`: the structured per-run result of the benchmark runner.
//
// Kept free of Playwright/DOM imports: it is also compiled by the root tsconfig through the CI
// summary script (`ci-helpers/generate-benchmark-summary.ts`). Telemetry record types are imported
// by relative path (type-only) so no `@lichtblick/suite-base` path alias is needed.

import {
  BYTES_PER_MIB,
  DROPPED_RECORDS_METRIC,
  HOST_CPU_SOURCES,
  MIN_SLOPE_POINTS,
  MIN_SLOPE_WINDOW_MS,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  PHASES_ORIGINS,
  POOL_METRIC_PREFIX,
  POOL_METRICS,
  PROCESS_METRICS,
  RENDERER_REALM,
  RESULT_SCHEMA_VERSION,
  RUN_MODES,
  RUNNER_EVENT_TYPES,
  RUNNER_REALM,
  STEADY_STATE_WARMUP_FRACTION,
  WEB_BROWSERS,
} from "./constants";
import { computeRunKpis } from "./kpis";
import type { RunKpisV1 } from "./kpis.types";
import { linearRegressionSlope, trapezoidIntegral } from "./numeric";
import {
  PanelSummaryV1,
  PanelsReadyCoverageV1,
  summarizePanels,
  summarizePanelsReady,
} from "./panelsSummary";
import { PipelineSummaryV1, summarizePipeline } from "./pipelineSummary";
import {
  HostCpuSourceV1,
  PoolGroup,
  PoolSeries,
  ProcessTick,
  ResultValidationMode,
  RunModeV1,
  WebBrowserV1,
} from "./schemaV1.types";
import { maxOf, mean, median, percentile } from "./stats";
import type { SteadyWindowSummaryV1 } from "./steadyWindow.types";
import type { CollectorsStateV1, TelemetrySelfSummaryV1 } from "./telemetrySelf.types";
import type { PipelineWindow } from "./types";
import type {
  TelemetryEvent,
  TelemetryLabels,
  TelemetryRecord,
  TelemetrySample,
} from "../../../packages/suite-base/src/util/telemetry/types";
import { LISTENER_DISPATCH_DURATION_METRIC } from "../../src/constants";
import { SCENARIO_GROUPS } from "../../src/scenarios/constants";
import type { ScenarioDescriptor } from "../../src/scenarios/scenarioControl";
import { RENDERER_METRICS } from "../../src/telemetry/collectors/constants";

export type { TelemetryBatch } from "../../../packages/suite-base/src/util/telemetry/types";
export type { TelemetryRecord, TelemetrySample };
export type { HostCpuSourceV1, PanelSummaryV1, WebBrowserV1 };

export type BenchmarkPlatform = "electron" | "web";

export type RunEnvironment = {
  os: string;
  arch: string;
  ci: boolean;
  userAgent?: string;
  electronVersion?: string;
  chromiumVersion?: string;
  cpuModel: string;
  /**
   * Logical CPUs available to processes on the host (see `runner/hostCpus.ts`). Electron's
   * `percentCPUUsage` is multiplied by it so both platforms report CPU as a per-core sum.
   */
  logicalCpus: number;
  totalMemBytes: number;
  /** Whether the scenario page was cross-origin isolated (enables UA-specific memory). */
  crossOriginIsolated?: boolean;
  /** Web only: which Chromium build ran the page (absent in older results: the headless shell). */
  webBrowser?: WebBrowserV1;
  /** Optional page collectors' state (overhead A/B runs with telemetry on). */
  collectors?: CollectorsStateV1;
  /**
   * Where the host collector read process CPU (absent in older results). With `ps` the CPU
   * summary (`summary.process` CPU fields) and `kpis.cpu` are empty, see `HostCpuSourceV1`.
   */
  hostCpuSource?: HostCpuSourceV1;
};

/**
 * Render environment measured by the runner on a blank page before the scenario loads (see
 * `runner/calibration.ts`).
 */
export type RenderCalibrationV1 = {
  /** Measured `requestAnimationFrame` rate (display refresh ceiling), fps rounded to 0.1. */
  fpsCeiling: number;
  /** WebGL `UNMASKED_RENDERER_WEBGL` (or `RENDERER`), `"unavailable"` without WebGL. */
  glRenderer: string;
  /** Late-frame threshold the page's frame collector used (`renderer.lateFrames`), ms. */
  lateFrameThresholdMs: number;
};

export type RunEnvironmentV1 = RunEnvironment & RenderCalibrationV1;

/**
 * `run.scenario`: the page's self-description of the scenario
 * (`window.lichtblickScenario.describe()`, see `benchmark/src/scenarios/scenarioControl.ts`).
 */
export type ScenarioDescriptorV1 = ScenarioDescriptor;

/** One OS process observed by a host collector at one poll. */
export type HostProcessSample = {
  /** Page monotonic clock (`lichtblickTelemetry.now()`) at the poll. */
  monotonicTs: number;
  pid: number;
  /** Normalized: "browser" | "renderer" | "gpu" | "utility" | other lowercased type. */
  processType: string;
  workingSetBytes?: number;
  peakWorkingSetBytes?: number;
  privateBytes?: number;
  /**
   * CPU since the previous poll as a per-core sum: 100 = one full core, so it may exceed 100 on
   * multi-core (Electron's `percentCPUUsage` is converted to this scale, see `runner/hostCpus.ts`).
   */
  cpuPercent?: number;
};

export type ListenerDispatchSample = { monotonicTs: number; value: number };

/** Runner-observed failure types (see `RUNNER_EVENT_TYPES`). */
export type RunnerEventType = (typeof RUNNER_EVENT_TYPES)[number];

/**
 * A crash, process loss or unexpected reload observed by the runner during a run. Any such event
 * fails the run (the result is still written as evidence).
 */
export type RunnerEvent = {
  type: RunnerEventType;
  /**
   * `performance.timeOrigin + performance.now()` of the observing process (runner or Electron
   * main), the same formula and epoch anchor as the page clock (`lichtblickTelemetry.now()`).
   */
  monotonicTs: number;
  /** `process.gone`: Electron `details.reason` (e.g. "crashed", "oom", "killed"). */
  reason?: string;
  /** "renderer" for renderer events, Electron `details.type` for child processes. */
  processType?: string;
  exitCode?: number;
  /** Page URL at the time of the event (crash/reload) or of the gone renderer. */
  url?: string;
};

/** Number of runner events per type (every type present, 0 if none). */
export type RunnerEventsSummaryV1 = Record<RunnerEventType, number>;

export type RunInfoV1 = {
  scenarioId: string;
  pipeline: string;
  platform: BenchmarkPlatform;
  telemetryEnabled: boolean;
  startedAtWall: string;
  finishedAtWall: string;
  startMonotonicTs: number;
  endMonotonicTs: number;
  /**
   * Page monotonic time at the end of the sampling window (before teardown: pause, data source
   * close, final publish). Rates use `[startMonotonicTs, windowEndMonotonicTs]`; absent in older
   * results (then `endMonotonicTs` is used).
   */
  windowEndMonotonicTs?: number;
  /** Scenario run or overhead A/B run (see `RunModeV1`); absent in older results. */
  mode?: RunModeV1;
  sampleIntervalMs: number;
  environment: RunEnvironmentV1;
  scenario: ScenarioDescriptorV1;
};

/**
 * `run` as found in stored results: older local artifacts lack `scenario`, `logicalCpus` and the
 * render calibration, and a partial result of a run that failed before the scenario could describe
 * itself lacks `scenario`. Written by the runner; read leniently by the viewer.
 */
export type PersistedRunInfoV1 = Omit<RunInfoV1, "scenario" | "environment"> & {
  scenario?: ScenarioDescriptorV1;
  environment: Omit<RunEnvironment, "logicalCpus"> &
    Partial<Pick<RunEnvironment, "logicalCpus">> &
    Partial<RenderCalibrationV1>;
};

/** `medianCpuPercent` is absent without CPU readings (e.g. `hostCpuSource` `ps`). */
export type ProcessTypeSummaryV1 = { peakWorkingSetBytes: number; medianCpuPercent?: number };

export type ProcessSummaryV1 = {
  /** Number of host polls that reported memory. */
  sampleCount: number;
  peakTotalWorkingSetBytes: number;
  meanTotalWorkingSetBytes: number;
  /** Median of the per-poll CPU totals; absent without CPU readings (e.g. `hostCpuSource` `ps`). */
  medianTotalCpuPercent?: number;
  /**
   * Least-squares slope of the total working set (all processes, per poll) over the steady-state
   * window, MiB/min. The window starts at the later of `STEADY_STATE_WARMUP_FRACTION` of the
   * measured window and the end of startup (`steadyStateFloorTs`). Absent when that window is
   * shorter than `MIN_SLOPE_WINDOW_MS` or has fewer than `MIN_SLOPE_POINTS` polls.
   */
  totalWorkingSetSlopeMiBPerMin?: number;
  /**
   * CPU time of all processes over the measured window: trapezoidal integral of the total CPU% / 100
   * between the first and last poll, seconds. Absent with fewer than 2 CPU polls.
   */
  cpuSeconds?: number;
  byType: Record<string, ProcessTypeSummaryV1>;
};

export type RendererSummaryV1 = {
  peakJsHeapUsedBytes?: number;
  lastUaSpecificMemoryBytes?: number;
  medianFps?: number;
  lateFrames?: number;
  /** Animation frames observed (`renderer.frames` total). */
  totalFrames?: number;
  longTasks?: number;
  /** Summed duration of the long tasks (`renderer.longTasks.durationMs` total), ms. */
  longTaskTotalMs?: number;
};

export type DistributionSummaryV1 = { count: number; p50: number; p90: number; max: number };

export type PoolSummaryV1 = {
  realm: string;
  poolId: string;
  acquires: number;
  releases: number;
  terminatedPins: number;
  activePinsFinal: number;
  /** `acquires - releases - terminatedPins === activePins` at every published pool snapshot. */
  invariantHolds: boolean;
  overBudgetPeriods: number;
  overBudgetDurationMs: number;
  evictions: number;
  rehydrations: number;
  highWaterResidentCount: number;
  highWaterActivePins: number;
};

/** Event the relative phase times are measured from (see `PHASES_ORIGINS`, `phasesOrigin`). */
export type PhasesOriginV1 = (typeof PHASES_ORIGINS)[number];

export type PhasesSummaryV1 = {
  /**
   * Origin of every relative time in `phases` and `panels`: the first `datasource.open` start, or
   * `app.ready` for runs without a data source open event (synthetic players). Absent: no origin,
   * no relative times.
   */
  origin?: PhasesOriginV1;
  firstMessageMs?: number;
  firstUsefulFrameMs?: number;
  /** `datasource.open` end - start (only with a `datasource.open` start). */
  openDurationMs?: number;
  /**
   * First `preload` end - start, only when that end completed (no `reason` label). A player has a
   * single preload phase, so a cancelled or failed end has no duration (see `preloadEndReason`).
   */
  preloadDurationMs?: number;
  /** `reason` label of the first `preload` end (`cancelled` / `error`); absent when it completed. */
  preloadEndReason?: string;
  /** First `layout.applied` (may be negative: the layout can apply before the source opens). */
  layoutAppliedMs?: number;
  /**
   * Latest per-panel first `panel.firstRender` among panels that emitted one; if none did, the
   * latest per-panel first `panel.mount`. Check `panelsReadyCoverage`.
   */
  panelsReadyMs?: number;
  /** Built-in React panels (Plot, RawMessages, ...) never emit `panel.firstRender`. */
  panelsReadyCoverage?: PanelsReadyCoverageV1;
};

export type SummaryV1 = {
  process: ProcessSummaryV1;
  renderer: RendererSummaryV1;
  listenerDispatchDurationMs?: DistributionSummaryV1;
  /** Keyed by `<realm>/<poolId>` (pool ids are only unique within one realm). */
  hydratedSourcePool?: { pools: Record<string, PoolSummaryV1> };
  /** Relative to `phases.origin` (first `datasource.open` start, else `app.ready`). */
  phases: PhasesSummaryV1;
  /** Keyed by layout panel id (e.g. `Plot!abc`); absent without panel telemetry. */
  panels?: Record<string, PanelSummaryV1>;
  /** Absent without pipeline telemetry. */
  pipeline?: PipelineSummaryV1;
  /** Present when the runner checked for crashes/reloads (`runnerEvents` is set). */
  runnerEvents?: RunnerEventsSummaryV1;
  /** Per-run KPI families derived from the fields above (`computeRunKpis`). */
  kpis: RunKpisV1;
  /** Fixed-schedule steady window statistics; only in telemetry overhead A/B runs. */
  steadyWindow?: SteadyWindowSummaryV1;
  /** In-page telemetry self-cost over the steady window; only in overhead runs with telemetry on. */
  telemetrySelf?: TelemetrySelfSummaryV1;
};

/** Everything of a v1 result but `run`. */
type ResultBodyV1 = {
  schemaVersion: typeof RESULT_SCHEMA_VERSION;
  samples: TelemetrySample[];
  events: TelemetryEvent[];
  dropped: Record<string, number>;
  sequenceGaps: Record<string, number>;
  /**
   * Crashes / gone processes / unexpected reloads seen by the runner, sorted by `monotonicTs`.
   * Absent in results of runners without crash detection; `[]` means "checked, none".
   */
  runnerEvents?: RunnerEvent[];
  summary: SummaryV1;
};

/** A complete v1 result, as written by the runner for a run that finished its window. */
export type BenchmarkResultV1 = ResultBodyV1 & { run: RunInfoV1 };

/** A v1 result as stored (see `PersistedRunInfoV1`), KPIs present or backfilled (`withRunKpis`). */
export type PersistedResultV1 = ResultBodyV1 & { run: PersistedRunInfoV1 };

/** A v1 result as read from disk: results written before `summary.kpis` existed lack it. */
export type StoredResultV1 = Omit<PersistedResultV1, "summary"> & {
  summary: Omit<SummaryV1, "kpis"> & { kpis?: RunKpisV1 };
};

export type BuildResultV1Input<TRun extends PersistedRunInfoV1 = RunInfoV1> = {
  run: TRun;
  /** Every record drained from `window.lichtblickTelemetry` (page and bridged worker realms). */
  pageRecords: readonly TelemetryRecord[];
  /** Sum of `TelemetryBatch.dropped` over all drains. */
  drainedDropped: number;
  /** `TelemetryBatch.realm` of the drained sink. */
  drainRealm: string;
  hostSamples: readonly HostProcessSample[];
  listenerDispatchSamples: readonly ListenerDispatchSample[];
  /** Runner crash/reload detection output; omitted → no `runnerEvents` in the result. */
  runnerEvents?: readonly RunnerEvent[];
};

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------

function compareRecords(a: TelemetryRecord, b: TelemetryRecord): number {
  if (a.monotonicTs !== b.monotonicTs) {
    return a.monotonicTs - b.monotonicTs;
  }
  if (a.realm !== b.realm) {
    return a.realm.localeCompare(b.realm);
  }
  return a.sequence - b.sequence;
}

/** Converts host process samples into `TelemetrySample`s (realm "runner", scope "process"). */
export function hostSamplesToTelemetry(
  hostSamples: readonly HostProcessSample[],
  startSequence = 0,
): TelemetrySample[] {
  const result: TelemetrySample[] = [];
  for (const host of hostSamples) {
    const labels: TelemetryLabels = { processType: host.processType, pid: String(host.pid) };
    const values: Array<[string, number | undefined, "bytes" | "percent"]> = [
      [PROCESS_METRICS.workingSetBytes, host.workingSetBytes, "bytes"],
      [PROCESS_METRICS.peakWorkingSetBytes, host.peakWorkingSetBytes, "bytes"],
      [PROCESS_METRICS.privateBytes, host.privateBytes, "bytes"],
      [PROCESS_METRICS.cpuPercent, host.cpuPercent, "percent"],
    ];
    for (const [metric, value, unit] of values) {
      if (value == undefined || !Number.isFinite(value)) {
        continue;
      }
      result.push({
        kind: "sample",
        realm: RUNNER_REALM,
        sequence: startSequence + result.length,
        monotonicTs: host.monotonicTs,
        metric,
        value,
        unit,
        scope: "process",
        metricType: "gauge",
        labels,
      });
    }
  }
  return result;
}

function listenerSamplesToTelemetry(samples: readonly ListenerDispatchSample[]): TelemetrySample[] {
  return samples.map((sample, index) => ({
    kind: "sample",
    realm: RENDERER_REALM,
    // Runner-assigned (these arrive through `recordFrameTimes`, not the telemetry sink), so they
    // are excluded from sequence gap detection.
    sequence: index,
    monotonicTs: sample.monotonicTs,
    metric: LISTENER_DISPATCH_DURATION_METRIC,
    value: sample.value,
    unit: "ms",
    scope: "renderer",
    metricType: "gauge",
  }));
}

/** Missing sequence numbers per realm (sequences start at 0 per realm; duplicates ignored). */
export function computeSequenceGaps(records: readonly TelemetryRecord[]): Record<string, number> {
  const byRealm = new Map<string, Set<number>>();
  for (const record of records) {
    let set = byRealm.get(record.realm);
    if (set == undefined) {
      set = new Set();
      byRealm.set(record.realm, set);
    }
    set.add(record.sequence);
  }
  const gaps: Record<string, number> = {};
  for (const [realm, sequences] of byRealm) {
    let max = -1;
    for (const sequence of sequences) {
      max = Math.max(max, sequence);
    }
    gaps[realm] = max + 1 - sequences.size;
  }
  return gaps;
}

/**
 * Drops per realm: the max `telemetry.droppedRecords{realm}` value per realm. The counters are
 * cumulative, and a worker realm can be reported both by the worker's own sink and by the
 * renderer's `ingest()`, so the max per realm (not the sum) avoids double counting. Drained drop
 * counts not covered by those counters (e.g. drops after the last publish) are attributed to the
 * drained sink's realm.
 */
export function computeDropped(
  samples: readonly TelemetrySample[],
  drainedDropped: number,
  drainRealm: string,
): Record<string, number> {
  const dropped: Record<string, number> = {};
  for (const sample of samples) {
    const realm = sample.labels?.realm;
    if (sample.metric !== DROPPED_RECORDS_METRIC || realm == undefined) {
      continue;
    }
    dropped[realm] = Math.max(dropped[realm] ?? 0, sample.value);
  }
  let counted = 0;
  for (const value of Object.values(dropped)) {
    counted += value;
  }
  if (drainedDropped > counted) {
    dropped[drainRealm] = (dropped[drainRealm] ?? 0) + drainedDropped - counted;
  }
  return dropped;
}

/**
 * End of startup on the page clock: the later of panels ready and first message (`phases`,
 * relative to the phases origin at `originTs`). Undefined without an origin or both phases.
 */
export function steadyStateFloorTs(
  phases: Pick<PhasesSummaryV1, "panelsReadyMs" | "firstMessageMs">,
  originTs: number | undefined,
): number | undefined {
  const readyMs = maxOf(
    [phases.panelsReadyMs, phases.firstMessageMs].filter((ms): ms is number => ms != undefined),
  );
  return originTs == undefined || readyMs == undefined ? undefined : originTs + readyMs;
}

/** Working-set slope over `[steadyStartTs, endTs]`, or undefined (see `ProcessSummaryV1`). */
function steadyStateSlope(
  inWindow: ReadonlyArray<[number, ProcessTick]>,
  steadyStartTs: number,
  endTs: number,
): number | undefined {
  if (endTs - steadyStartTs < MIN_SLOPE_WINDOW_MS) {
    return undefined;
  }
  const slopePoints = inWindow
    .filter(([ts, tick]) => tick.hasWs && ts >= steadyStartTs)
    .map(([ts, tick]) => ({ x: (ts - steadyStartTs) / MS_PER_MINUTE, y: tick.ws / BYTES_PER_MIB }));
  return slopePoints.length >= MIN_SLOPE_POINTS ? linearRegressionSlope(slopePoints) : undefined;
}

/** Steady-state working-set slope and CPU time of the per-poll totals (see `ProcessSummaryV1`). */
function summarizeProcessTrends(
  ticks: ReadonlyMap<number, ProcessTick>,
  measuredWindow: PipelineWindow | undefined,
  startupEndTs: number | undefined,
): Pick<ProcessSummaryV1, "totalWorkingSetSlopeMiBPerMin" | "cpuSeconds"> {
  const sorted = [...ticks].sort(([a], [b]) => a - b);
  if (sorted.length === 0) {
    return {};
  }
  const startTs = measuredWindow?.startTs ?? sorted[0]![0];
  const endTs = measuredWindow?.endTs ?? sorted.at(-1)![0];
  const warmupEndTs = startTs + STEADY_STATE_WARMUP_FRACTION * (endTs - startTs);
  const steadyStartTs = Math.max(warmupEndTs, startupEndTs ?? warmupEndTs);
  const inWindow = sorted.filter(([ts]) => ts >= startTs && ts <= endTs);

  const cpuPoints = inWindow
    .filter(([, tick]) => tick.hasCpu)
    .map(([ts, tick]) => ({ x: (ts - startTs) / MS_PER_SECOND, y: tick.cpu / 100 }));

  const trends: Pick<ProcessSummaryV1, "totalWorkingSetSlopeMiBPerMin" | "cpuSeconds"> = {};
  const slope = steadyStateSlope(inWindow, steadyStartTs, endTs);
  if (slope != undefined) {
    trends.totalWorkingSetSlopeMiBPerMin = slope;
  }
  if (cpuPoints.length >= 2) {
    trends.cpuSeconds = trapezoidIntegral(cpuPoints);
  }
  return trends;
}

/**
 * Host process summary. `measuredWindow` (`[startMonotonicTs, windowEndMonotonicTs]`)
 * bounds the working-set slope and CPU time; without it the first and last poll are used.
 * `startupEndTs` (`steadyStateFloorTs`) delays the start of the slope's steady window.
 */
export function summarizeProcess(
  hostSamples: readonly HostProcessSample[],
  measuredWindow?: PipelineWindow,
  startupEndTs?: number,
): ProcessSummaryV1 {
  type Tick = ProcessTick;
  const ticks = new Map<number, Tick>();
  const typeTicks = new Map<string, Map<number, Tick>>();
  const addTo = (map: Map<number, Tick>, sample: HostProcessSample) => {
    let tick = map.get(sample.monotonicTs);
    if (tick == undefined) {
      tick = { ws: 0, hasWs: false, cpu: 0, hasCpu: false };
      map.set(sample.monotonicTs, tick);
    }
    if (sample.workingSetBytes != undefined) {
      tick.ws += sample.workingSetBytes;
      tick.hasWs = true;
    }
    if (sample.cpuPercent != undefined) {
      tick.cpu += sample.cpuPercent;
      tick.hasCpu = true;
    }
  };
  for (const sample of hostSamples) {
    addTo(ticks, sample);
    let perType = typeTicks.get(sample.processType);
    if (perType == undefined) {
      perType = new Map();
      typeTicks.set(sample.processType, perType);
    }
    addTo(perType, sample);
  }
  const wsOf = (map: Map<number, Tick>) =>
    [...map.values()].filter((tick) => tick.hasWs).map((tick) => tick.ws);
  const cpuOf = (map: Map<number, Tick>) =>
    [...map.values()].filter((tick) => tick.hasCpu).map((tick) => tick.cpu);

  const totals = wsOf(ticks);
  const byType: Record<string, ProcessTypeSummaryV1> = {};
  for (const [processType, perType] of [...typeTicks].sort(([a], [b]) => a.localeCompare(b))) {
    const typeSummary: ProcessTypeSummaryV1 = { peakWorkingSetBytes: maxOf(wsOf(perType)) ?? 0 };
    const typeCpu = median(cpuOf(perType));
    if (typeCpu != undefined) {
      typeSummary.medianCpuPercent = typeCpu;
    }
    byType[processType] = typeSummary;
  }
  const summary: ProcessSummaryV1 = {
    sampleCount: totals.length,
    peakTotalWorkingSetBytes: maxOf(totals) ?? 0,
    meanTotalWorkingSetBytes: mean(totals) ?? 0,
    ...summarizeProcessTrends(ticks, measuredWindow, startupEndTs),
    byType,
  };
  const totalCpu = median(cpuOf(ticks));
  if (totalCpu != undefined) {
    summary.medianTotalCpuPercent = totalCpu;
  }
  return summary;
}

/**
 * Host samples the process summary is computed from: without CPU when the collector fell back to
 * `ps` (`hostCpuSource` `ps`), so interval CPU from polls before the fallback is not summarized as
 * if it covered the whole run.
 */
function summarizedHostSamples(
  hostSamples: readonly HostProcessSample[],
  hostCpuSource: HostCpuSourceV1 | undefined,
): readonly HostProcessSample[] {
  if (hostCpuSource !== "ps") {
    return hostSamples;
  }
  return hostSamples.map(({ cpuPercent: _cpuPercent, ...sample }) => sample);
}

function valuesOf(samples: readonly TelemetrySample[], metric: string): number[] {
  return samples.filter((sample) => sample.metric === metric).map((sample) => sample.value);
}

function lastValueOf(samples: readonly TelemetrySample[], metric: string): number | undefined {
  // `samples` is sorted by monotonicTs.
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i]!.metric === metric) {
      return samples[i]!.value;
    }
  }
  return undefined;
}

export function summarizeRenderer(pageSamples: readonly TelemetrySample[]): RendererSummaryV1 {
  const renderer = pageSamples.filter((sample) => sample.realm === RENDERER_REALM);
  const summary: RendererSummaryV1 = {};
  const peakHeap = maxOf(valuesOf(renderer, RENDERER_METRICS.jsHeapUsedBytes));
  const uaMemory = lastValueOf(renderer, RENDERER_METRICS.uaSpecificMemoryBytes);
  const fps = median(valuesOf(renderer, RENDERER_METRICS.fps));
  // Counters carry the cumulative total in `value`.
  const lateFrames = maxOf(valuesOf(renderer, RENDERER_METRICS.lateFrames));
  const totalFrames = maxOf(valuesOf(renderer, RENDERER_METRICS.frames));
  const longTasks = maxOf(valuesOf(renderer, RENDERER_METRICS.longTasksCount));
  const longTaskTotalMs = maxOf(valuesOf(renderer, RENDERER_METRICS.longTasksDurationMs));
  if (peakHeap != undefined) {
    summary.peakJsHeapUsedBytes = peakHeap;
  }
  if (uaMemory != undefined) {
    summary.lastUaSpecificMemoryBytes = uaMemory;
  }
  if (fps != undefined) {
    summary.medianFps = fps;
  }
  if (lateFrames != undefined) {
    summary.lateFrames = lateFrames;
  }
  if (totalFrames != undefined) {
    summary.totalFrames = totalFrames;
  }
  if (longTasks != undefined) {
    summary.longTasks = longTasks;
  }
  if (longTaskTotalMs != undefined) {
    summary.longTaskTotalMs = longTaskTotalMs;
  }
  return summary;
}

export function summarizeDistribution(
  values: readonly number[],
): DistributionSummaryV1 | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return {
    count: values.length,
    p50: percentile(values, 50)!,
    p90: percentile(values, 90)!,
    max: maxOf(values)!,
  };
}

function latestAtOrBefore(samples: readonly TelemetrySample[] | undefined, ts: number): number {
  let value = 0;
  for (const sample of samples ?? []) {
    if (sample.monotonicTs > ts) {
      break;
    }
    value = sample.value;
  }
  return value;
}

/** Groups the `pipeline.hydratedSourcePool.*` samples per `<realm>/<poolId>`, then per metric. */
function groupPoolSeries(pageSamples: readonly TelemetrySample[]): Map<string, PoolGroup> {
  const pools = new Map<string, PoolGroup>();
  for (const sample of pageSamples) {
    const poolId = sample.labels?.poolId;
    if (!sample.metric.startsWith(POOL_METRIC_PREFIX) || poolId == undefined) {
      continue;
    }
    const key = `${sample.realm}/${poolId}`;
    let pool = pools.get(key);
    if (pool == undefined) {
      pool = { realm: sample.realm, poolId, series: new Map() };
      pools.set(key, pool);
    }
    let list = pool.series.get(sample.metric);
    if (list == undefined) {
      list = [];
      pool.series.set(sample.metric, list);
    }
    list.push(sample);
  }
  return pools;
}

/** Whether every `activePins` snapshot equals acquires − releases − terminatedPins at its time. */
function activePinSnapshotsHold(
  series: PoolSeries,
  activePins: readonly TelemetrySample[],
): boolean {
  return activePins.every((snapshot) => {
    const ts = snapshot.monotonicTs;
    const expected =
      latestAtOrBefore(series.get(POOL_METRICS.acquires), ts) -
      latestAtOrBefore(series.get(POOL_METRICS.releases), ts) -
      latestAtOrBefore(series.get(POOL_METRICS.terminatedPins), ts);
    return expected === snapshot.value;
  });
}

function summarizePool({ realm, poolId, series }: PoolGroup): PoolSummaryV1 {
  const finalCounter = (metric: string) =>
    maxOf((series.get(metric) ?? []).map((s) => s.value)) ?? 0;
  const activePins = series.get(POOL_METRICS.activePins) ?? [];
  const acquires = finalCounter(POOL_METRICS.acquires);
  const releases = finalCounter(POOL_METRICS.releases);
  const terminatedPins = finalCounter(POOL_METRICS.terminatedPins);
  const activePinsFinal = activePins.at(-1)?.value ?? 0;
  const invariantHolds =
    activePinSnapshotsHold(series, activePins) &&
    acquires - releases - terminatedPins === activePinsFinal;
  return {
    realm,
    poolId,
    acquires,
    releases,
    terminatedPins,
    activePinsFinal,
    invariantHolds,
    overBudgetPeriods: finalCounter(POOL_METRICS.overBudgetPeriods),
    overBudgetDurationMs: finalCounter(POOL_METRICS.overBudgetDurationMs),
    evictions: finalCounter(POOL_METRICS.evictions),
    rehydrations: finalCounter(POOL_METRICS.rehydrations),
    highWaterResidentCount: finalCounter(POOL_METRICS.highWaterResidentCount),
    highWaterActivePins: finalCounter(POOL_METRICS.highWaterActivePins),
  };
}

/** Summarizes `pipeline.hydratedSourcePool.*` series per `<realm>/<poolId>`. */
export function summarizePools(
  pageSamples: readonly TelemetrySample[],
): Record<string, PoolSummaryV1> | undefined {
  const pools = groupPoolSeries(pageSamples);
  if (pools.size === 0) {
    return undefined;
  }
  const result: Record<string, PoolSummaryV1> = {};
  for (const [key, pool] of [...pools].sort(([a], [b]) => a.localeCompare(b))) {
    result[key] = summarizePool(pool);
  }
  return result;
}

function firstEventTs(
  events: readonly TelemetryEvent[],
  name: TelemetryEvent["name"],
  phase: TelemetryEvent["phase"],
): number | undefined {
  return events.find((event) => event.name === name && event.phase === phase)?.monotonicTs;
}

/** Origin of the relative phase/panel times: first `datasource.open` start, else `app.ready`. */
export function phasesOrigin(
  events: readonly TelemetryEvent[],
): { origin: PhasesOriginV1; ts: number } | undefined {
  const openStart = firstEventTs(events, "datasource.open", "start");
  if (openStart != undefined) {
    return { origin: "datasource.open", ts: openStart };
  }
  const appReady = firstEventTs(events, "app.ready", "instant");
  return appReady == undefined ? undefined : { origin: "app.ready", ts: appReady };
}

export function summarizePhases(events: readonly TelemetryEvent[]): PhasesSummaryV1 {
  const phases: PhasesSummaryV1 = {};
  const preloadStart = firstEventTs(events, "preload", "start");
  const preloadEnd = events.find((event) => event.name === "preload" && event.phase === "end");
  const preloadEndReason = preloadEnd?.labels?.reason;
  if (preloadEndReason != undefined) {
    phases.preloadEndReason = preloadEndReason;
  } else if (preloadStart != undefined && preloadEnd != undefined) {
    phases.preloadDurationMs = preloadEnd.monotonicTs - preloadStart;
  }
  const origin = phasesOrigin(events);
  const ready = summarizePanelsReady(events, origin?.ts);
  if (ready.panelsReadyCoverage != undefined) {
    phases.panelsReadyCoverage = ready.panelsReadyCoverage;
  }
  if (origin == undefined) {
    return phases;
  }
  phases.origin = origin.origin;
  const relative = (ts: number | undefined) => (ts == undefined ? undefined : ts - origin.ts);
  const firstMessageMs = relative(firstEventTs(events, "datasource.firstMessage", "instant"));
  const firstUsefulFrameMs = relative(firstEventTs(events, "frame.firstUseful", "instant"));
  const openEnd = firstEventTs(events, "datasource.open", "end");
  const layoutAppliedMs = relative(firstEventTs(events, "layout.applied", "instant"));
  if (firstMessageMs != undefined) {
    phases.firstMessageMs = firstMessageMs;
  }
  if (firstUsefulFrameMs != undefined) {
    phases.firstUsefulFrameMs = firstUsefulFrameMs;
  }
  if (origin.origin === "datasource.open" && openEnd != undefined) {
    phases.openDurationMs = openEnd - origin.ts;
  }
  if (layoutAppliedMs != undefined) {
    phases.layoutAppliedMs = layoutAppliedMs;
  }
  if (ready.panelsReadyMs != undefined) {
    phases.panelsReadyMs = ready.panelsReadyMs;
  }
  return phases;
}

/** Counts runner events per type; every type is present (0 if none). */
export function summarizeRunnerEvents(events: readonly RunnerEvent[]): RunnerEventsSummaryV1 {
  const counts: RunnerEventsSummaryV1 = {
    "renderer.crash": 0,
    "process.gone": 0,
    "renderer.reload": 0,
  };
  for (const event of events) {
    counts[event.type] += 1;
  }
  return counts;
}

/**
 * Assembles the v1 result: merged/sorted samples & events, loss accounting and summaries. The
 * result's `run` is `input.run` as given: a complete `RunInfoV1` yields a `BenchmarkResultV1`; the
 * runner's partial result of a failed run may lack `run.scenario` (`PersistedRunInfoV1`).
 */
export function buildResultV1<TRun extends PersistedRunInfoV1 = RunInfoV1>(
  input: BuildResultV1Input<TRun>,
): ResultBodyV1 & { run: TRun } {
  const pageSamples: TelemetrySample[] = [];
  const events: TelemetryEvent[] = [];
  for (const record of input.pageRecords) {
    if (record.kind === "sample") {
      pageSamples.push(record);
    } else {
      events.push(record);
    }
  }
  pageSamples.sort(compareRecords);
  events.sort(compareRecords);

  const samples = [
    ...pageSamples,
    ...hostSamplesToTelemetry(input.hostSamples),
    ...listenerSamplesToTelemetry(input.listenerDispatchSamples),
  ].sort(compareRecords);

  const measuredWindow: PipelineWindow = {
    startTs: input.run.startMonotonicTs,
    endTs: input.run.windowEndMonotonicTs ?? input.run.endMonotonicTs,
  };
  const phases = summarizePhases(events);
  const originTs = phasesOrigin(events)?.ts;
  const summary: Omit<SummaryV1, "kpis"> = {
    process: summarizeProcess(
      summarizedHostSamples(input.hostSamples, input.run.environment.hostCpuSource),
      measuredWindow,
      steadyStateFloorTs(phases, originTs),
    ),
    renderer: summarizeRenderer(pageSamples),
    phases,
  };
  const listener = summarizeDistribution(input.listenerDispatchSamples.map((s) => s.value));
  if (listener != undefined) {
    summary.listenerDispatchDurationMs = listener;
  }
  const pools = summarizePools(pageSamples);
  if (pools != undefined) {
    summary.hydratedSourcePool = { pools };
  }
  const panels = summarizePanels(pageSamples, events, originTs);
  if (panels != undefined) {
    summary.panels = panels;
  }
  const pipeline = summarizePipeline(pageSamples, measuredWindow);
  if (pipeline != undefined) {
    summary.pipeline = pipeline;
  }

  const runnerEvents =
    input.runnerEvents == undefined
      ? undefined
      : [...input.runnerEvents].sort((a, b) => a.monotonicTs - b.monotonicTs);
  if (runnerEvents != undefined) {
    summary.runnerEvents = summarizeRunnerEvents(runnerEvents);
  }
  const dropped = computeDropped(pageSamples, input.drainedDropped, input.drainRealm);
  const result: ResultBodyV1 & { run: TRun } = {
    schemaVersion: RESULT_SCHEMA_VERSION,
    run: input.run,
    samples,
    events,
    dropped,
    sequenceGaps: computeSequenceGaps(input.pageRecords),
    summary: { ...summary, kpis: computeRunKpis({ run: input.run, dropped, summary }) },
  };
  if (runnerEvents != undefined) {
    result.runnerEvents = runnerEvents;
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Runtime validation (lightweight, structural)
// ---------------------------------------------------------------------------------------------

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function checkNumberRecord(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${where} must be an object`);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!isFiniteNumber(entry)) {
      errors.push(`${where}.${key} must be a finite number`);
    }
  }
}

function checkFields(
  obj: Record<string, unknown>,
  where: string,
  fields: Record<string, "string" | "number" | "boolean" | "number?" | "string?" | "boolean?">,
  errors: string[],
): void {
  for (const [field, type] of Object.entries(fields)) {
    const value = obj[field];
    const optional = type.endsWith("?");
    if (value == undefined) {
      if (!optional) {
        errors.push(`${where}.${field} is missing`);
      }
      continue;
    }
    const baseType = optional ? type.slice(0, -1) : type;
    const ok = baseType === "number" ? isFiniteNumber(value) : typeof value === baseType;
    if (!ok) {
      errors.push(`${where}.${field} must be a ${baseType}`);
    }
  }
}

/** Validates the fields of one telemetry record (`at` locates it in the error messages). */
function checkRecord(
  record: Record<string, unknown>,
  at: string,
  kind: "sample" | "event",
  errors: string[],
): void {
  if (record.kind !== kind) {
    errors.push(`${at}.kind must be "${kind}"`);
  }
  checkFields(record, at, { realm: "string", sequence: "number", monotonicTs: "number" }, errors);
  if (kind === "sample") {
    checkFields(record, at, { metric: "string", value: "number", unit: "string" }, errors);
    if (record.metricType !== "gauge" && record.metricType !== "counter") {
      errors.push(`${at}.metricType must be "gauge" or "counter"`);
    }
  } else {
    checkFields(record, at, { name: "string", phase: "string" }, errors);
  }
}

function checkRecords(
  value: unknown,
  where: string,
  kind: "sample" | "event",
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push(`${where} must be an array`);
    return;
  }
  let previousTs = -Infinity;
  let sorted = true;
  for (let index = 0; index < value.length; index++) {
    const record: unknown = value[index];
    const at = `${where}[${index}]`;
    if (!isRecord(record)) {
      errors.push(`${at} must be an object`);
      continue;
    }
    checkRecord(record, at, kind, errors);
    if (typeof record.monotonicTs === "number") {
      sorted &&= record.monotonicTs >= previousTs;
      previousTs = record.monotonicTs;
    }
  }
  if (!sorted) {
    errors.push(`${where} must be sorted by monotonicTs`);
  }
}

/** Validates the optional top-level `runnerEvents` array (absent is valid). */
function checkRunnerEvents(value: unknown, errors: string[]): void {
  if (value == undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push("runnerEvents must be an array");
    return;
  }
  const types: readonly string[] = RUNNER_EVENT_TYPES;
  for (let index = 0; index < value.length; index++) {
    const event: unknown = value[index];
    const at = `runnerEvents[${index}]`;
    if (!isRecord(event)) {
      errors.push(`${at} must be an object`);
      continue;
    }
    if (typeof event.type !== "string" || !types.includes(event.type)) {
      errors.push(`${at}.type must be one of ${RUNNER_EVENT_TYPES.join(", ")}`);
    }
    checkFields(
      event,
      at,
      {
        monotonicTs: "number",
        reason: "string?",
        processType: "string?",
        exitCode: "number?",
        url: "string?",
      },
      errors,
    );
  }
}

function checkStringArray(value: unknown, where: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${where} must be an array`);
    return;
  }
  if (value.some((entry) => typeof entry !== "string")) {
    errors.push(`${where} must contain only strings`);
  }
}

function checkStringRecord(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${where} must be an object`);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      errors.push(`${where}.${key} must be a string`);
    }
  }
}

function checkScenarioPanels(panels: unknown, errors: string[]): void {
  if (!Array.isArray(panels)) {
    errors.push("run.scenario.panels must be an array");
    return;
  }
  for (let index = 0; index < panels.length; index++) {
    const panel: unknown = panels[index];
    const at = `run.scenario.panels[${index}]`;
    if (isRecord(panel)) {
      checkFields(panel, at, { id: "string", type: "string", title: "string?" }, errors);
    } else {
      errors.push(`${at} must be an object`);
    }
  }
}

/** Validates `run.scenario` (`ScenarioDescriptorV1`); required in strict mode only. */
function checkScenarioDescriptor(
  run: Record<string, unknown>,
  mode: ResultValidationMode,
  errors: string[],
): void {
  const scenario = run.scenario;
  if (scenario == undefined) {
    if (mode === "strict") {
      errors.push("run.scenario is missing");
    }
    return;
  }
  if (!isRecord(scenario)) {
    errors.push("run.scenario must be an object");
    return;
  }
  checkFields(
    scenario,
    "run.scenario",
    {
      scenarioId: "string",
      description: "string",
      group: "string",
      layout: "string",
      player: "string",
      durationMs: "number?",
    },
    errors,
  );
  if (typeof run.scenarioId === "string" && scenario.scenarioId !== run.scenarioId) {
    errors.push("run.scenario.scenarioId must equal run.scenarioId");
  }
  const groups: readonly unknown[] = SCENARIO_GROUPS;
  if (typeof scenario.group === "string" && !groups.includes(scenario.group)) {
    errors.push(`run.scenario.group must be one of ${SCENARIO_GROUPS.join(", ")}`);
  }
  if (isRecord(scenario.dataSource)) {
    checkFields(
      scenario.dataSource,
      "run.scenario.dataSource",
      { factoryId: "string", displayName: "string?" },
      errors,
    );
  } else {
    errors.push("run.scenario.dataSource must be an object");
  }
  checkStringArray(scenario.tags, "run.scenario.tags", errors);
  checkStringRecord(scenario.params, "run.scenario.params", errors);
  checkScenarioPanels(scenario.panels, errors);
}

/**
 * Order of the run's monotonic window: `start <= windowEnd <= end`. Complete runs (strict) also
 * need `end > start`; a partial result of a run that failed before the page was ready has
 * `start == end` (both from the runner clock).
 */
function checkRunWindow(
  run: Record<string, unknown>,
  mode: ResultValidationMode,
  errors: string[],
): void {
  const { startMonotonicTs: start, endMonotonicTs: end, windowEndMonotonicTs: windowEnd } = run;
  if (!isFiniteNumber(start) || !isFiniteNumber(end)) {
    return;
  }
  if (end < start) {
    errors.push("run.endMonotonicTs must not be before run.startMonotonicTs");
  } else if (end === start && mode === "strict") {
    errors.push("run.endMonotonicTs must be after run.startMonotonicTs");
  }
  if (isFiniteNumber(windowEnd) && (windowEnd < start || windowEnd > end)) {
    errors.push(
      "run.windowEndMonotonicTs must lie within [run.startMonotonicTs, run.endMonotonicTs]",
    );
  }
}

/** Validates `run` (fields, window order, platform, ISO dates, environment, scenario). */
function checkRun(run: unknown, mode: ResultValidationMode, errors: string[]): void {
  if (!isRecord(run)) {
    errors.push("run must be an object");
    return;
  }
  checkFields(
    run,
    "run",
    {
      scenarioId: "string",
      pipeline: "string",
      platform: "string",
      telemetryEnabled: "boolean",
      startedAtWall: "string",
      finishedAtWall: "string",
      startMonotonicTs: "number",
      endMonotonicTs: "number",
      windowEndMonotonicTs: "number?",
      sampleIntervalMs: "number",
    },
    errors,
  );
  checkRunWindow(run, mode, errors);
  if (run.platform !== "electron" && run.platform !== "web") {
    errors.push(`run.platform must be "electron" or "web"`);
  }
  // Written by every current run; absent in older stored results.
  if (run.mode == undefined ? mode === "strict" : !RUN_MODES.includes(run.mode as RunModeV1)) {
    errors.push(`run.mode must be one of ${RUN_MODES.join(", ")}`);
  }
  for (const field of ["startedAtWall", "finishedAtWall"] as const) {
    if (typeof run[field] === "string" && Number.isNaN(Date.parse(run[field]))) {
      errors.push(`run.${field} must be an ISO date`);
    }
  }
  checkRunEnvironment(run.environment, mode, errors);
  checkScenarioDescriptor(run, mode, errors);
}

function checkRunEnvironment(
  environment: unknown,
  mode: ResultValidationMode,
  errors: string[],
): void {
  if (!isRecord(environment)) {
    errors.push("run.environment must be an object");
    return;
  }
  checkFields(
    environment,
    "run.environment",
    {
      os: "string",
      arch: "string",
      ci: "boolean",
      cpuModel: "string",
      totalMemBytes: "number",
      userAgent: "string?",
      electronVersion: "string?",
      chromiumVersion: "string?",
      crossOriginIsolated: "boolean?",
    },
    errors,
  );
  if (
    environment.webBrowser != undefined &&
    !WEB_BROWSERS.includes(environment.webBrowser as WebBrowserV1)
  ) {
    errors.push(`run.environment.webBrowser must be one of ${WEB_BROWSERS.join(", ")}`);
  }
  // Absent in older stored results.
  if (
    environment.hostCpuSource != undefined &&
    !HOST_CPU_SOURCES.includes(environment.hostCpuSource as HostCpuSourceV1)
  ) {
    errors.push(`run.environment.hostCpuSource must be one of ${HOST_CPU_SOURCES.join(", ")}`);
  }
  // Logical CPU count and render calibration (`RenderCalibrationV1`): absent in older stored results.
  const strict = mode === "strict";
  checkFields(
    environment,
    "run.environment",
    {
      logicalCpus: strict ? "number" : "number?",
      fpsCeiling: strict ? "number" : "number?",
      glRenderer: strict ? "string" : "string?",
      lateFrameThresholdMs: strict ? "number" : "number?",
    },
    errors,
  );
  checkCollectorsState(environment.collectors, errors);
}

const COLLECTOR_STATES: ReadonlySet<unknown> = new Set(["on", "off", "unsupported", "disabled"]);

/** Validates the optional `run.environment.collectors` (overhead A/B runs only). */
function checkCollectorsState(collectors: unknown, errors: string[]): void {
  if (collectors == undefined) {
    return;
  }
  if (!isRecord(collectors)) {
    errors.push("run.environment.collectors must be an object");
  } else if (!COLLECTOR_STATES.has(collectors.uaMemory)) {
    errors.push(
      'run.environment.collectors.uaMemory must be "on", "off", "unsupported" or "disabled"',
    );
  }
}

/** Validates the optional `summary.steadyWindow` (overhead A/B runs only). */
function checkSteadyWindow(steadyWindow: unknown, errors: string[]): void {
  if (steadyWindow == undefined) {
    return;
  }
  const where = "summary.steadyWindow";
  if (!isRecord(steadyWindow)) {
    errors.push(`${where} must be an object`);
    return;
  }
  checkFields(
    steadyWindow,
    where,
    {
      warmupMs: "number",
      requestedPolls: "number",
      polls: "number",
      overruns: "number",
      windowMismatch: "boolean",
      maxPollLatencyMs: "number?",
      clockSyncRttMs: "number?",
      startMonotonicTs: "number",
      endMonotonicTs: "number",
      medianTotalCpuPercent: "number",
      meanTotalCpuPercent: "number",
      meanTotalWorkingSetBytes: "number",
      peakTotalWorkingSetBytes: "number",
    },
    errors,
  );
  // `start == end` is valid: a window without steady polls ends at its priming poll.
  const { startMonotonicTs: start, endMonotonicTs: end } = steadyWindow;
  if (isFiniteNumber(start) && isFiniteNumber(end) && end < start) {
    errors.push(`${where}.endMonotonicTs must not be before ${where}.startMonotonicTs`);
  }
  checkNumberRecord(
    steadyWindow.meanWorkingSetBytesByType,
    `${where}.meanWorkingSetBytesByType`,
    errors,
  );
  checkNumberRecord(steadyWindow.processSet, `${where}.processSet`, errors);
  const { mainThread } = steadyWindow;
  if (mainThread == undefined) {
    return;
  }
  if (!isRecord(mainThread)) {
    errors.push(`${where}.mainThread must be an object`);
    return;
  }
  const { longTaskBlockedMsPerSec, fps, ...extra } = mainThread;
  checkFields(
    { longTaskBlockedMsPerSec, fps },
    `${where}.mainThread`,
    { longTaskBlockedMsPerSec: "number", fps: "number" },
    errors,
  );
  checkNumberRecord(extra, `${where}.mainThread`, errors);
}

/** Validates the optional `summary.telemetrySelf` (overhead A/B runs with telemetry on only). */
function checkTelemetrySelf(telemetrySelf: unknown, errors: string[]): void {
  if (telemetrySelf == undefined) {
    return;
  }
  const where = "summary.telemetrySelf";
  if (!isRecord(telemetrySelf)) {
    errors.push(`${where} must be an object`);
    return;
  }
  checkFields(
    telemetrySelf,
    where,
    {
      windowSec: "number",
      recordsPerSec: "number",
      uaCalls: "number",
      uaResolved: "number?",
      uaFailures: "number?",
      uaResolveMsMean: "number?",
      meanEmitNs: "number?",
      estimatedEmitMsPerSec: "number?",
      fractionOfCore: "number",
    },
    errors,
  );
  if (isRecord(telemetrySelf.msPerSec)) {
    checkFields(telemetrySelf.msPerSec, `${where}.msPerSec`, { total: "number" }, errors);
    checkNumberRecord(telemetrySelf.msPerSec.byComponent, `${where}.msPerSec.byComponent`, errors);
  } else {
    errors.push(`${where}.msPerSec must be an object`);
  }
  if (telemetrySelf.emitCostNs != undefined) {
    checkNumberRecord(telemetrySelf.emitCostNs, `${where}.emitCostNs`, errors);
  }
}

function checkProcessSummary(processSummary: unknown, errors: string[]): void {
  if (!isRecord(processSummary)) {
    errors.push("summary.process must be an object");
    return;
  }
  checkFields(
    processSummary,
    "summary.process",
    {
      sampleCount: "number",
      peakTotalWorkingSetBytes: "number",
      meanTotalWorkingSetBytes: "number",
      medianTotalCpuPercent: "number?",
      totalWorkingSetSlopeMiBPerMin: "number?",
      cpuSeconds: "number?",
    },
    errors,
  );
  const { sampleCount } = processSummary;
  if (isFiniteNumber(sampleCount) && (!Number.isInteger(sampleCount) || sampleCount < 0)) {
    errors.push("summary.process.sampleCount must be a non-negative integer");
  }
  if (!isRecord(processSummary.byType)) {
    errors.push("summary.process.byType must be an object");
  }
}

function checkRendererSummary(renderer: unknown, errors: string[]): void {
  if (!isRecord(renderer)) {
    errors.push("summary.renderer must be an object");
    return;
  }
  checkFields(
    renderer,
    "summary.renderer",
    {
      peakJsHeapUsedBytes: "number?",
      lastUaSpecificMemoryBytes: "number?",
      medianFps: "number?",
      lateFrames: "number?",
      totalFrames: "number?",
      longTasks: "number?",
      longTaskTotalMs: "number?",
    },
    errors,
  );
}

/** Validates the optional `summary.listenerDispatchDurationMs` distribution (absent is valid). */
function checkListenerDispatch(distribution: unknown, errors: string[]): void {
  if (distribution == undefined) {
    return;
  }
  if (!isRecord(distribution)) {
    errors.push("summary.listenerDispatchDurationMs must be an object");
    return;
  }
  checkFields(
    distribution,
    "summary.listenerDispatchDurationMs",
    { count: "number", p50: "number", p90: "number", max: "number" },
    errors,
  );
}

function checkPool(key: string, pool: unknown, errors: string[]): void {
  const at = `summary.hydratedSourcePool.pools.${key}`;
  if (!isRecord(pool)) {
    errors.push(`${at} must be an object`);
    return;
  }
  if (typeof pool.invariantHolds !== "boolean") {
    errors.push(`${at}.invariantHolds must be a boolean`);
  }
  checkFields(
    pool,
    at,
    {
      acquires: "number",
      releases: "number",
      terminatedPins: "number",
      activePinsFinal: "number",
      overBudgetPeriods: "number",
      overBudgetDurationMs: "number",
      evictions: "number",
      rehydrations: "number",
    },
    errors,
  );
}

/** Validates the optional `summary.hydratedSourcePool` object (absent is valid). */
function checkHydratedSourcePool(hydratedSourcePool: unknown, errors: string[]): void {
  if (hydratedSourcePool == undefined) {
    return;
  }
  const pools = isRecord(hydratedSourcePool) ? hydratedSourcePool.pools : undefined;
  if (!isRecord(pools)) {
    errors.push("summary.hydratedSourcePool.pools must be an object");
    return;
  }
  for (const [key, pool] of Object.entries(pools)) {
    checkPool(key, pool, errors);
  }
}

const KPI_FAMILIES = [
  "stability",
  "memory",
  "cpu",
  "smoothness",
  "startup",
  "throughput",
  "renderCost",
] as const;

/** Validates `summary.kpis` (`RunKpisV1`); required in strict mode only. */
function checkKpis(kpis: unknown, mode: ResultValidationMode, errors: string[]): void {
  if (kpis == undefined) {
    if (mode === "strict") {
      errors.push("summary.kpis is missing");
    }
    return;
  }
  if (!isRecord(kpis)) {
    errors.push("summary.kpis must be an object");
    return;
  }
  for (const family of KPI_FAMILIES) {
    if (!isRecord(kpis[family])) {
      errors.push(`summary.kpis.${family} must be an object`);
    }
  }
  if (isRecord(kpis.stability)) {
    checkFields(kpis.stability, "summary.kpis.stability", { healthy: "boolean" }, errors);
    checkStringArray(kpis.stability.reasons, "summary.kpis.stability.reasons", errors);
  }
  if (isRecord(kpis.smoothness)) {
    checkFields(kpis.smoothness, "summary.kpis.smoothness", { lowFps: "boolean" }, errors);
  }
  if (isRecord(kpis.renderCost)) {
    checkNumberRecord(
      kpis.renderCost.p90RenderMsByPanelType,
      "summary.kpis.renderCost.p90RenderMsByPanelType",
      errors,
    );
  }
}

function checkSummary(
  summary: Record<string, unknown>,
  mode: ResultValidationMode,
  errors: string[],
): void {
  checkKpis(summary.kpis, mode, errors);
  checkProcessSummary(summary.process, errors);
  checkRendererSummary(summary.renderer, errors);
  checkListenerDispatch(summary.listenerDispatchDurationMs, errors);
  checkHydratedSourcePool(summary.hydratedSourcePool, errors);
  if (isRecord(summary.phases)) {
    checkPhases(summary.phases, errors);
  } else {
    errors.push("summary.phases must be an object");
  }
  checkPanels(summary.panels, errors);
  checkPipeline(summary.pipeline, errors);
  if (summary.runnerEvents != undefined) {
    checkNumberRecord(summary.runnerEvents, "summary.runnerEvents", errors);
  }
  checkSteadyWindow(summary.steadyWindow, errors);
  checkTelemetrySelf(summary.telemetrySelf, errors);
}

/**
 * Structural validation of a parsed `benchmark-result.v1.json`; returns the list of problems.
 * `strict` (default) checks a result as the runner writes it; `lenient` accepts stored results
 * lacking `run.scenario` / the render calibration / `summary.kpis` (see `ResultValidationMode`,
 * `StoredResultV1`).
 */
export function validateResultV1(obj: unknown, mode: ResultValidationMode = "strict"): string[] {
  if (!isRecord(obj)) {
    return ["result must be an object"];
  }
  const errors: string[] = [];
  if (obj.schemaVersion !== RESULT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${RESULT_SCHEMA_VERSION}`);
  }
  checkRun(obj.run, mode, errors);
  checkRecords(obj.samples, "samples", "sample", errors);
  checkRecords(obj.events, "events", "event", errors);
  checkNumberRecord(obj.dropped, "dropped", errors);
  checkNumberRecord(obj.sequenceGaps, "sequenceGaps", errors);
  checkRunnerEvents(obj.runnerEvents, errors);
  if (isRecord(obj.summary)) {
    checkSummary(obj.summary, mode, errors);
    if (isRecord(obj.run)) {
      checkRunMode(obj.run, obj.summary, mode, errors);
    }
  } else {
    errors.push("summary must be an object");
  }
  return errors;
}

/**
 * Strict: an overhead A/B run has `summary.steadyWindow` and a scenario run has none, so the
 * scenario views can never pick up an overhead run that lost its marker (or the reverse). Lenient
 * (older results, partial results of failed overhead runs without a steady window): only an
 * explicit `run.mode` "scenario" with a steady window is rejected (`isOverheadRun` would treat it
 * as a scenario run).
 */
function checkRunMode(
  run: Record<string, unknown>,
  summary: Record<string, unknown>,
  mode: ResultValidationMode,
  errors: string[],
): void {
  const overhead = run.mode === "overhead";
  const steady = summary.steadyWindow != undefined;
  if (mode === "lenient") {
    if (run.mode === "scenario" && steady) {
      errors.push('summary.steadyWindow is only allowed with run.mode "overhead"');
    }
    return;
  }
  if (overhead && !steady) {
    errors.push('summary.steadyWindow is required with run.mode "overhead"');
  } else if (!overhead && steady) {
    errors.push('summary.steadyWindow is only allowed with run.mode "overhead"');
  }
}

function checkPhases(phases: Record<string, unknown>, errors: string[]): void {
  checkFields(
    phases,
    "summary.phases",
    {
      origin: "string?",
      firstMessageMs: "number?",
      firstUsefulFrameMs: "number?",
      openDurationMs: "number?",
      preloadDurationMs: "number?",
      preloadEndReason: "string?",
      layoutAppliedMs: "number?",
      panelsReadyMs: "number?",
    },
    errors,
  );
  const origins: readonly unknown[] = PHASES_ORIGINS;
  if (phases.origin != undefined && !origins.includes(phases.origin)) {
    errors.push(`summary.phases.origin must be one of ${PHASES_ORIGINS.join(", ")}`);
  }
  const coverage = phases.panelsReadyCoverage;
  if (coverage == undefined) {
    return;
  }
  if (isRecord(coverage)) {
    checkFields(
      coverage,
      "summary.phases.panelsReadyCoverage",
      { mounted: "number", firstRendered: "number" },
      errors,
    );
  } else {
    errors.push("summary.phases.panelsReadyCoverage must be an object");
  }
}

/** Validates the optional `summary.panels` record (absent is valid). */
function checkPanels(panels: unknown, errors: string[]): void {
  if (panels == undefined) {
    return;
  }
  if (!isRecord(panels)) {
    errors.push("summary.panels must be an object");
    return;
  }
  for (const [panelId, panel] of Object.entries(panels)) {
    const at = `summary.panels.${panelId}`;
    if (!isRecord(panel)) {
      errors.push(`${at} must be an object`);
      continue;
    }
    checkFields(
      panel,
      at,
      {
        panelType: "string",
        mountedAtMs: "number?",
        unmountedAtMs: "number?",
        firstRenderMs: "number?",
        mounts: "number",
        messages: "number",
        messageBytes: "number",
        rangeMessages: "number",
        rangeBytes: "number",
        renderedMessages: "number?",
        renderedBytes: "number?",
        renders: "number?",
        renderMeanMs: "number?",
        renderMaxMs: "number?",
        renderP90WindowMaxMs: "number?",
        skipped: "number?",
      },
      errors,
    );
  }
}

/** Validates the optional `summary.pipeline` object (absent is valid; every field optional). */
function checkPipeline(pipeline: unknown, errors: string[]): void {
  if (pipeline == undefined) {
    return;
  }
  if (!isRecord(pipeline)) {
    errors.push("summary.pipeline must be an object");
    return;
  }
  const { memoryPeakBytes, ...numbers } = pipeline;
  for (const [field, value] of Object.entries(numbers)) {
    if (value != undefined && !isFiniteNumber(value)) {
      errors.push(`summary.pipeline.${field} must be a number`);
    }
  }
  if (memoryPeakBytes != undefined) {
    checkNumberRecord(memoryPeakBytes, "summary.pipeline.memoryPeakBytes", errors);
  }
}
