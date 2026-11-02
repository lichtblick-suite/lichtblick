// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// `benchmark-result.v1.json`: the structured per-run result of the benchmark runner.
//
// Kept free of Playwright/DOM imports: it is also compiled by the root tsconfig through the CI
// summary script (`ci-helpers/generate-benchmark-summary.ts`). Telemetry record types are imported
// by relative path (type-only) so no `@lichtblick/suite-base` path alias is needed.

import {
  DROPPED_RECORDS_METRIC,
  PHASES_ORIGINS,
  POOL_METRIC_PREFIX,
  POOL_METRICS,
  PROCESS_METRICS,
  RENDERER_REALM,
  RESULT_SCHEMA_VERSION,
  RUNNER_EVENT_TYPES,
  RUNNER_REALM,
} from "./constants";
import {
  PanelSummaryV1,
  PanelsReadyCoverageV1,
  summarizePanels,
  summarizePanelsReady,
} from "./panelsSummary";
import { PipelineSummaryV1, summarizePipeline } from "./pipelineSummary";
import { PoolSeries } from "./schemaV1.types";
import { maxOf, mean, median, percentile } from "./stats";
import type {
  TelemetryEvent,
  TelemetryLabels,
  TelemetryRecord,
  TelemetrySample,
} from "../../../packages/suite-base/src/util/telemetry/types";
import { LISTENER_DISPATCH_DURATION_METRIC } from "../../src/constants";
import { RENDERER_METRICS } from "../../src/telemetry/collectors/constants";

export type { TelemetryBatch } from "../../../packages/suite-base/src/util/telemetry/types";
export type { TelemetryEvent, TelemetryRecord, TelemetrySample };
export type { PanelSummaryV1, PanelsReadyCoverageV1, PipelineSummaryV1 };
export { mean, median, percentile };

export type BenchmarkPlatform = "electron" | "web";

export type RunEnvironment = {
  os: string;
  arch: string;
  ci: boolean;
  userAgent?: string;
  electronVersion?: string;
  chromiumVersion?: string;
  cpuModel: string;
  totalMemBytes: number;
  /** Whether the scenario page was cross-origin isolated (enables UA-specific memory). */
  crossOriginIsolated?: boolean;
};

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
  /** Percent of one core since the previous poll (may exceed 100 on multi-core). */
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
  sampleIntervalMs: number;
  environment: RunEnvironment;
};

export type ProcessTypeSummaryV1 = { peakWorkingSetBytes: number; medianCpuPercent: number };

export type ProcessSummaryV1 = {
  /** Number of host polls that reported memory. */
  sampleCount: number;
  peakTotalWorkingSetBytes: number;
  meanTotalWorkingSetBytes: number;
  medianTotalCpuPercent: number;
  byType: Record<string, ProcessTypeSummaryV1>;
};

export type RendererSummaryV1 = {
  peakJsHeapUsedBytes?: number;
  lastUaSpecificMemoryBytes?: number;
  medianFps?: number;
  lateFrames?: number;
  longTasks?: number;
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
  preloadDurationMs?: number;
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
};

export type BenchmarkResultV1 = {
  schemaVersion: typeof RESULT_SCHEMA_VERSION;
  run: RunInfoV1;
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

export type BuildResultV1Input = {
  run: RunInfoV1;
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
 * Drops per realm: the last `telemetry.droppedRecords{realm}` counter value per realm; drained drop
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

export function summarizeProcess(hostSamples: readonly HostProcessSample[]): ProcessSummaryV1 {
  type Tick = { ws: number; hasWs: boolean; cpu: number; hasCpu: boolean };
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
    byType[processType] = {
      peakWorkingSetBytes: maxOf(wsOf(perType)) ?? 0,
      medianCpuPercent: median(cpuOf(perType)) ?? 0,
    };
  }
  return {
    sampleCount: totals.length,
    peakTotalWorkingSetBytes: maxOf(totals) ?? 0,
    meanTotalWorkingSetBytes: mean(totals) ?? 0,
    medianTotalCpuPercent: median(cpuOf(ticks)) ?? 0,
    byType,
  };
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
  const longTasks = maxOf(valuesOf(renderer, RENDERER_METRICS.longTasksCount));
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
  if (longTasks != undefined) {
    summary.longTasks = longTasks;
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

/** Summarizes `pipeline.hydratedSourcePool.*` series per `<realm>/<poolId>`. */
export function summarizePools(
  pageSamples: readonly TelemetrySample[],
): Record<string, PoolSummaryV1> | undefined {
  const pools = new Map<string, { realm: string; poolId: string; series: PoolSeries }>();
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
  if (pools.size === 0) {
    return undefined;
  }

  const result: Record<string, PoolSummaryV1> = {};
  for (const [key, { realm, poolId, series }] of [...pools].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const finalCounter = (metric: string) =>
      maxOf((series.get(metric) ?? []).map((s) => s.value)) ?? 0;
    const activePins = series.get(POOL_METRICS.activePins) ?? [];
    let invariantHolds = true;
    for (const snapshot of activePins) {
      const ts = snapshot.monotonicTs;
      const expected =
        latestAtOrBefore(series.get(POOL_METRICS.acquires), ts) -
        latestAtOrBefore(series.get(POOL_METRICS.releases), ts) -
        latestAtOrBefore(series.get(POOL_METRICS.terminatedPins), ts);
      if (expected !== snapshot.value) {
        invariantHolds = false;
      }
    }
    const acquires = finalCounter(POOL_METRICS.acquires);
    const releases = finalCounter(POOL_METRICS.releases);
    const terminatedPins = finalCounter(POOL_METRICS.terminatedPins);
    const activePinsFinal = activePins.at(-1)?.value ?? 0;
    if (acquires - releases - terminatedPins !== activePinsFinal) {
      invariantHolds = false;
    }
    result[key] = {
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
  const preloadEnd = firstEventTs(events, "preload", "end");
  if (preloadStart != undefined && preloadEnd != undefined) {
    phases.preloadDurationMs = preloadEnd - preloadStart;
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

/** Assembles the v1 result: merged/sorted samples & events, loss accounting and summaries. */
export function buildResultV1(input: BuildResultV1Input): BenchmarkResultV1 {
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

  const summary: SummaryV1 = {
    process: summarizeProcess(input.hostSamples),
    renderer: summarizeRenderer(pageSamples),
    phases: summarizePhases(events),
  };
  const listener = summarizeDistribution(input.listenerDispatchSamples.map((s) => s.value));
  if (listener != undefined) {
    summary.listenerDispatchDurationMs = listener;
  }
  const pools = summarizePools(pageSamples);
  if (pools != undefined) {
    summary.hydratedSourcePool = { pools };
  }
  const panels = summarizePanels(pageSamples, events, phasesOrigin(events)?.ts);
  if (panels != undefined) {
    summary.panels = panels;
  }
  const pipeline = summarizePipeline(pageSamples, {
    startTs: input.run.startMonotonicTs,
    endTs: input.run.windowEndMonotonicTs ?? input.run.endMonotonicTs,
  });
  if (pipeline != undefined) {
    summary.pipeline = pipeline;
  }

  const result: BenchmarkResultV1 = {
    schemaVersion: RESULT_SCHEMA_VERSION,
    run: input.run,
    samples,
    events,
    dropped: computeDropped(pageSamples, input.drainedDropped, input.drainRealm),
    sequenceGaps: computeSequenceGaps(input.pageRecords),
    summary,
  };
  if (input.runnerEvents != undefined) {
    result.runnerEvents = [...input.runnerEvents].sort((a, b) => a.monotonicTs - b.monotonicTs);
    summary.runnerEvents = summarizeRunnerEvents(result.runnerEvents);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Runtime validation (lightweight, structural)
// ---------------------------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
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
  fields: Record<string, "string" | "number" | "boolean" | "number?" | "string?">,
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

/** Structural validation of a parsed `benchmark-result.v1.json`; returns the list of problems. */
export function validateResultV1(obj: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(obj)) {
    return ["result must be an object"];
  }
  if (obj.schemaVersion !== RESULT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${RESULT_SCHEMA_VERSION}`);
  }

  const run = obj.run;
  if (isRecord(run)) {
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
    if (run.platform !== "electron" && run.platform !== "web") {
      errors.push(`run.platform must be "electron" or "web"`);
    }
    for (const field of ["startedAtWall", "finishedAtWall"] as const) {
      if (typeof run[field] === "string" && Number.isNaN(Date.parse(run[field]))) {
        errors.push(`run.${field} must be an ISO date`);
      }
    }
    if (isRecord(run.environment)) {
      checkFields(
        run.environment,
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
        },
        errors,
      );
    } else {
      errors.push("run.environment must be an object");
    }
  } else {
    errors.push("run must be an object");
  }

  checkRecords(obj.samples, "samples", "sample", errors);
  checkRecords(obj.events, "events", "event", errors);
  checkNumberRecord(obj.dropped, "dropped", errors);
  checkNumberRecord(obj.sequenceGaps, "sequenceGaps", errors);
  checkRunnerEvents(obj.runnerEvents, errors);

  const summary = obj.summary;
  if (!isRecord(summary)) {
    errors.push("summary must be an object");
    return errors;
  }
  if (isRecord(summary.process)) {
    checkFields(
      summary.process,
      "summary.process",
      {
        peakTotalWorkingSetBytes: "number",
        meanTotalWorkingSetBytes: "number",
        medianTotalCpuPercent: "number",
      },
      errors,
    );
    if (!isRecord(summary.process.byType)) {
      errors.push("summary.process.byType must be an object");
    }
  } else {
    errors.push("summary.process must be an object");
  }
  if (isRecord(summary.renderer)) {
    checkFields(
      summary.renderer,
      "summary.renderer",
      {
        peakJsHeapUsedBytes: "number?",
        lastUaSpecificMemoryBytes: "number?",
        medianFps: "number?",
        lateFrames: "number?",
        longTasks: "number?",
      },
      errors,
    );
  } else {
    errors.push("summary.renderer must be an object");
  }
  if (summary.listenerDispatchDurationMs != undefined) {
    if (isRecord(summary.listenerDispatchDurationMs)) {
      checkFields(
        summary.listenerDispatchDurationMs,
        "summary.listenerDispatchDurationMs",
        { count: "number", p50: "number", p90: "number", max: "number" },
        errors,
      );
    } else {
      errors.push("summary.listenerDispatchDurationMs must be an object");
    }
  }
  if (summary.hydratedSourcePool != undefined) {
    const pools = isRecord(summary.hydratedSourcePool)
      ? summary.hydratedSourcePool.pools
      : undefined;
    if (isRecord(pools)) {
      for (const [key, pool] of Object.entries(pools)) {
        if (!isRecord(pool)) {
          errors.push(`summary.hydratedSourcePool.pools.${key} must be an object`);
          continue;
        }
        if (typeof pool.invariantHolds !== "boolean") {
          errors.push(`summary.hydratedSourcePool.pools.${key}.invariantHolds must be a boolean`);
        }
        checkFields(
          pool,
          `summary.hydratedSourcePool.pools.${key}`,
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
    } else {
      errors.push("summary.hydratedSourcePool.pools must be an object");
    }
  }
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
  return errors;
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
