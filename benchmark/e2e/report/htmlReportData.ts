// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Data side of the interim HTML viewer (`htmlReport.ts`): run selection, screenshot matching and
// the chart series derived from `benchmark-result.v1.json`. Pure; free of DOM/Playwright/Node
// imports.

import { CHECKPOINT_ORDER, MAX_POINTS_PER_DATASET, MIB, STALE_AFTER_MS } from "./constants";
import {
  ChartDataset,
  ChartSpec,
  LoadedResult,
  ParseOutcome,
  PhaseMarker,
  Point,
  RunChartData,
  ScreenshotLink,
} from "./types";
import {
  PANEL_METRICS,
  PIPELINE_METRICS,
  POOL_METRICS,
  PROCESS_METRICS,
  RESULT_V1_SUFFIX,
} from "../result/constants";
import { withRunKpis } from "../result/kpis";
import {
  PersistedResultV1,
  StoredResultV1,
  TelemetrySample,
  phasesOrigin,
  validateResultV1,
} from "../result/schemaV1";
import { counterTotalAt, observationMetrics, seriesKey } from "../result/series";
import { maxOf } from "../result/stats";

/**
 * Parses and validates one `*.benchmark-result.v1.json` file's contents. Lenient: results written
 * before `run.scenario` / the render calibration existed still load (shown as "not recorded");
 * results without `summary.kpis` get them backfilled (`withRunKpis`, marked `recomputed`).
 */
export function parseResultFile(fileName: string, text: string): ParseOutcome<LoadedResult> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ok: false, reason: `invalid JSON (${String(error)})` };
  }
  const errors = validateResultV1(json, "lenient");
  if (errors.length > 0) {
    const more = errors.length > 1 ? ` (+${errors.length - 1} more)` : "";
    return { ok: false, reason: `not a valid benchmark-result.v1: ${errors[0]}${more}` };
  }
  return {
    ok: true,
    value: { fileName, result: withRunKpis(json as StoredResultV1) },
  };
}

/** `<scenarioId>-<platform>[-telemetry-off]-<ts>`: shared by a run's result and screenshots. */
export function runStem(fileName: string): string {
  return fileName.endsWith(RESULT_V1_SUFFIX)
    ? fileName.slice(0, -RESULT_V1_SUFFIX.length)
    : fileName;
}

/**
 * Scenario runs shown by the viewer, sorted by scenario, platform, telemetry on before off, then
 * newest first. By default only the latest run (by `finishedAtWall`) per scenario × platform ×
 * telemetry mode; `all` keeps every run.
 */
export function selectRuns(
  results: readonly LoadedResult[],
  { all }: { all: boolean },
): LoadedResult[] {
  let selected: LoadedResult[];
  if (all) {
    selected = [...results];
  } else {
    const latest = new Map<string, LoadedResult>();
    for (const loaded of results) {
      const { scenarioId, platform, telemetryEnabled } = loaded.result.run;
      const key = `${scenarioId}|${platform}|${telemetryEnabled}`;
      const existing = latest.get(key);
      if (
        existing == undefined ||
        existing.result.run.finishedAtWall < loaded.result.run.finishedAtWall
      ) {
        latest.set(key, loaded);
      }
    }
    selected = [...latest.values()];
  }
  return selected.sort((a, b) => {
    const ra = a.result.run;
    const rb = b.result.run;
    const order = [
      ra.scenarioId.localeCompare(rb.scenarioId),
      ra.platform.localeCompare(rb.platform),
      Number(rb.telemetryEnabled) - Number(ra.telemetryEnabled),
      rb.finishedAtWall.localeCompare(ra.finishedAtWall),
    ];
    return order.find((value) => value !== 0) ?? 0;
  });
}

/** Short, timezone-explicit UTC time of an ISO timestamp: `2026-10-30 16:44Z` (input if unparsable). */
export function formatRunTime(isoWall: string): string {
  const ms = Date.parse(isoWall);
  if (Number.isNaN(ms)) {
    return isoWall;
  }
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}Z`;
}

/** Latest `finishedAtWall` (epoch ms) of the runs, or undefined without parsable times. */
export function newestFinishedAtMs(results: readonly LoadedResult[]): number | undefined {
  let newest: number | undefined;
  for (const { result } of results) {
    const ms = Date.parse(result.run.finishedAtWall);
    if (!Number.isNaN(ms) && (newest == undefined || ms > newest)) {
      newest = ms;
    }
  }
  return newest;
}

/** Hours a run finished before the newest run when that exceeds `STALE_AFTER_MS`, else undefined. */
export function staleHours(
  finishedAtWall: string,
  newestMs: number | undefined,
): number | undefined {
  const ms = Date.parse(finishedAtWall);
  if (newestMs == undefined || Number.isNaN(ms) || newestMs - ms <= STALE_AFTER_MS) {
    return undefined;
  }
  return (newestMs - ms) / (60 * 60 * 1000);
}

/** Screenshots of one run: `<stem>-<checkpoint>.png`, ordered loaded → mid → end. */
export function matchScreenshots(
  stem: string,
  screenshotFiles: readonly string[],
): ScreenshotLink[] {
  const prefix = `${stem}-`;
  const links: ScreenshotLink[] = [];
  for (const fileName of screenshotFiles) {
    if (!fileName.startsWith(prefix) || !fileName.endsWith(".png")) {
      continue;
    }
    const checkpoint = fileName.slice(prefix.length, -".png".length);
    // `<stem>-<checkpoint>` only: a longer stem sharing the prefix would contain another dash.
    if (!checkpoint.includes("-")) {
      links.push({ checkpoint, fileName });
    }
  }
  const rank = (checkpoint: string) => {
    const index = CHECKPOINT_ORDER.indexOf(checkpoint);
    return index === -1 ? CHECKPOINT_ORDER.length : index;
  };
  return links.sort((a, b) => rank(a.checkpoint) - rank(b.checkpoint));
}

/**
 * Caps a series at `maxPoints` while keeping spikes: the points are split into `maxPoints / 2`
 * buckets and each bucket keeps its minimum and maximum (in x order). First and last points are
 * always kept. Shorter series are returned unchanged.
 */
export function downsample(points: readonly Point[], maxPoints = MAX_POINTS_PER_DATASET): Point[] {
  if (points.length <= maxPoints || maxPoints < 4) {
    return [...points];
  }
  const inner = points.slice(1, -1);
  const buckets = Math.floor((maxPoints - 2) / 2);
  const result: Point[] = [points[0]!];
  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = Math.floor((bucket * inner.length) / buckets);
    const end = Math.floor(((bucket + 1) * inner.length) / buckets);
    if (end <= start) {
      continue;
    }
    let minIndex = start;
    let maxIndex = start;
    for (let i = start; i < end; i++) {
      if (inner[i]!.y < inner[minIndex]!.y) {
        minIndex = i;
      }
      if (inner[i]!.y > inner[maxIndex]!.y) {
        maxIndex = i;
      }
    }
    if (minIndex === maxIndex) {
      result.push(inner[minIndex]!);
    } else {
      result.push(inner[Math.min(minIndex, maxIndex)]!, inner[Math.max(minIndex, maxIndex)]!);
    }
  }
  result.push(points.at(-1)!);
  return result;
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    let list = groups.get(key);
    if (list == undefined) {
      list = [];
      groups.set(key, list);
    }
    list.push(item);
  }
  return groups;
}

function sortedUnique(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Per-second rate of a counter (summed over its series) between consecutive publishes: at every
 * publish timestamp the summed cumulative total is taken (`counterTotalAt`), and each point is
 * Δtotal / Δt at the later publish.
 */
export function counterRatePoints(
  samples: readonly TelemetrySample[],
  toX: (ts: number) => number,
  scale = 1,
): Point[] {
  const grid = sortedUnique(samples.map((sample) => sample.monotonicTs));
  const points: Point[] = [];
  let previousTs: number | undefined;
  let previousTotal = 0;
  for (const ts of grid) {
    const total = counterTotalAt(samples, ts) ?? 0;
    if (previousTs != undefined && ts > previousTs) {
      points.push({
        x: round(toX(ts)),
        y: round(((total - previousTotal) / ((ts - previousTs) / 1000)) * scale, 4),
      });
    }
    previousTs = ts;
    previousTotal = total;
  }
  return points;
}

/** Gauge summed over its series at each publish (latest value per series, step-hold). */
function gaugeTotalPoints(
  samples: readonly TelemetrySample[],
  toX: (ts: number) => number,
  scale = 1,
): Point[] {
  const byTs = groupBy(samples, (sample) => String(sample.monotonicTs));
  const latest = new Map<string, number>();
  const points: Point[] = [];
  for (const ts of sortedUnique(samples.map((sample) => sample.monotonicTs))) {
    for (const sample of byTs.get(String(ts)) ?? []) {
      latest.set(seriesKey(sample), sample.value);
    }
    let total = 0;
    for (const value of latest.values()) {
      total += value;
    }
    points.push({ x: round(toX(ts)), y: round(total * scale, 4) });
  }
  return points;
}

/**
 * Mean of an `observe()` series per publish window: Δ`.sum` / Δ`.count` between consecutive
 * publishes of one series (only windows with observations are published).
 */
export function observationMeanPoints(
  countSamples: readonly TelemetrySample[],
  sumSamples: readonly TelemetrySample[],
  toX: (ts: number) => number,
): Point[] {
  const sumAt = new Map(
    sumSamples.map((sample) => [`${sample.realm}|${sample.monotonicTs}`, sample]),
  );
  const points: Point[] = [];
  for (const count of [...countSamples].sort((a, b) => a.monotonicTs - b.monotonicTs)) {
    const sum = sumAt.get(`${count.realm}|${count.monotonicTs}`);
    const countDelta = count.delta ?? 0;
    if (sum == undefined || countDelta <= 0) {
      continue;
    }
    points.push({ x: round(toX(count.monotonicTs)), y: round((sum.delta ?? 0) / countDelta, 4) });
  }
  return points;
}

function samplesOf(samples: readonly TelemetrySample[], metric: string): TelemetrySample[] {
  return samples.filter((sample) => sample.metric === metric);
}

function dataset(label: string, data: Point[], extra: Partial<ChartDataset> = {}): ChartDataset {
  return { label, data: downsample(data), ...extra };
}

function nonEmpty(datasets: ChartDataset[]): ChartDataset[] {
  return datasets.filter((entry) => entry.data.length > 0);
}

function memoryChart(
  samples: readonly TelemetrySample[],
  toX: (ts: number) => number,
): ChartSpec | undefined {
  const workingSet = samplesOf(samples, PROCESS_METRICS.workingSetBytes);
  if (workingSet.length === 0) {
    return undefined;
  }
  const polls = sortedUnique(workingSet.map((sample) => sample.monotonicTs));
  const byType = groupBy(workingSet, (sample) => sample.labels?.processType ?? "unknown");
  const datasets: ChartDataset[] = [];
  for (const type of [...byType.keys()].sort((a, b) => a.localeCompare(b))) {
    const perPoll = new Map<number, number>();
    for (const sample of byType.get(type)!) {
      perPoll.set(sample.monotonicTs, (perPoll.get(sample.monotonicTs) ?? 0) + sample.value);
    }
    // Every poll gets a value (0 when the type had no process) so the stack stays aligned.
    const data = polls.map((ts) => ({
      x: round(toX(ts)),
      y: round((perPoll.get(ts) ?? 0) / MIB, 2),
    }));
    datasets.push(dataset(type, data, { stacked: true }));
  }
  const totals = polls.map((ts) => {
    const total = workingSet
      .filter((sample) => sample.monotonicTs === ts)
      .reduce((sum, sample) => sum + sample.value, 0);
    return { x: round(toX(ts)), y: round(total / MIB, 2) };
  });
  datasets.push(dataset("total", totals, { dashed: true }));
  return {
    id: "memory",
    title: "Memory per process type (working set)",
    yLabel: "MiB",
    stacked: true,
    datasets,
  };
}

function heapChart(
  samples: readonly TelemetrySample[],
  toX: (ts: number) => number,
): ChartSpec | undefined {
  const renderer = samples.filter((sample) => sample.realm === "renderer");
  const datasets = nonEmpty([
    dataset(
      "used",
      gaugeTotalPoints(samplesOf(renderer, "renderer.jsHeap.usedBytes"), toX, 1 / MIB),
    ),
    dataset(
      "total",
      gaugeTotalPoints(samplesOf(renderer, "renderer.jsHeap.totalBytes"), toX, 1 / MIB),
    ),
  ]);
  if (datasets.length === 0) {
    return undefined;
  }
  // The limit (GiBs) would flatten used/total into the x axis: report it in the title instead.
  const limit = maxOf(samplesOf(renderer, "renderer.jsHeap.limitBytes").map((s) => s.value));
  const limitText = limit == undefined ? "" : ` (limit ${Math.round(limit / MIB)} MiB)`;
  return { id: "heap", title: `Renderer JS heap${limitText}`, yLabel: "MiB", datasets };
}

function pipelineChart(
  samples: readonly TelemetrySample[],
  toX: (ts: number) => number,
): ChartSpec | undefined {
  const datasets = nonEmpty([
    dataset(
      "received msg/s",
      counterRatePoints(samplesOf(samples, PIPELINE_METRICS.messagesReceived), toX),
    ),
    dataset(
      "delivered msg/s",
      counterRatePoints(samplesOf(samples, PIPELINE_METRICS.messagesDelivered), toX),
    ),
    dataset(
      "received MiB/s",
      counterRatePoints(samplesOf(samples, PIPELINE_METRICS.messagesReceivedBytes), toX, 1 / MIB),
      { secondary: true, dashed: true },
    ),
  ]);
  return datasets.length === 0
    ? undefined
    : {
        id: "pipeline",
        title: "Pipeline throughput",
        yLabel: "messages / s",
        y2Label: "MiB / s",
        datasets,
      };
}

function cacheChart(
  samples: readonly TelemetrySample[],
  toX: (ts: number) => number,
): ChartSpec | undefined {
  const datasets = nonEmpty([
    dataset(
      "block cache",
      gaugeTotalPoints(samplesOf(samples, PIPELINE_METRICS.blockCacheBytes), toX, 1 / MIB),
    ),
    dataset(
      "source cache",
      gaugeTotalPoints(samplesOf(samples, PIPELINE_METRICS.sourceCacheBytes), toX, 1 / MIB),
    ),
  ]);
  return datasets.length === 0
    ? undefined
    : { id: "caches", title: "Pipeline caches", yLabel: "MiB", datasets };
}

function poolChart(
  samples: readonly TelemetrySample[],
  toX: (ts: number) => number,
): ChartSpec | undefined {
  const datasets = nonEmpty([
    dataset(
      "resident MiB",
      gaugeTotalPoints(samplesOf(samples, POOL_METRICS.residentBytes), toX, 1 / MIB),
    ),
    dataset(
      "resident count",
      gaugeTotalPoints(samplesOf(samples, POOL_METRICS.residentCount), toX),
      { secondary: true },
    ),
    dataset("active pins", gaugeTotalPoints(samplesOf(samples, POOL_METRICS.activePins), toX), {
      secondary: true,
      dashed: true,
    }),
  ]);
  return datasets.length === 0
    ? undefined
    : {
        id: "pool",
        title: "HydratedSourcePool",
        yLabel: "MiB",
        y2Label: "count",
        datasets,
      };
}

function panelCharts(
  samples: readonly TelemetrySample[],
  toX: (ts: number) => number,
): ChartSpec[] {
  const panelSamples = samples.filter((sample) => sample.labels?.panelId != undefined);
  const byPanel = groupBy(panelSamples, (sample) => sample.labels!.panelId!);
  const panelIds = [...byPanel.keys()].sort((a, b) => a.localeCompare(b));
  const renderMetrics = observationMetrics(PANEL_METRICS.renderDurationMs);
  const renderMeans: ChartDataset[] = [];
  const deliveryRates: ChartDataset[] = [];
  for (const panelId of panelIds) {
    const own = byPanel.get(panelId)!;
    renderMeans.push(
      dataset(
        panelId,
        observationMeanPoints(
          samplesOf(own, renderMetrics.count),
          samplesOf(own, renderMetrics.sum),
          toX,
        ),
      ),
    );
    // Current-frame and range deliveries are distinct series, so their totals add up.
    const delivered = own.filter(
      (sample) =>
        sample.metric === PANEL_METRICS.messagesDelivered ||
        sample.metric === PANEL_METRICS.rangeMessagesDelivered,
    );
    deliveryRates.push(dataset(panelId, counterRatePoints(delivered, toX)));
  }
  const charts: ChartSpec[] = [];
  const means = nonEmpty(renderMeans);
  if (means.length > 0) {
    charts.push({
      id: "panel-render",
      title: "Panel render mean per window (adapter panels)",
      yLabel: "ms",
      datasets: means,
    });
  }
  const rates = nonEmpty(deliveryRates);
  if (rates.length > 0) {
    charts.push({
      id: "panel-delivery",
      title: "Panel delivered messages / s (current frame + range)",
      yLabel: "messages / s",
      datasets: rates,
    });
  }
  return charts;
}

/** Phase markers of a run, in seconds from the origin. */
function phaseMarkers(result: PersistedResultV1, originTs: number): PhaseMarker[] {
  const markers: PhaseMarker[] = [];
  const seen = new Set<string>();
  const toX = (ts: number) => round((ts - originTs) / 1000);
  const firstOf = (label: string, name: string, phase?: string) => {
    if (seen.has(label)) {
      return;
    }
    const event = result.events.find(
      (candidate) => candidate.name === name && (phase == undefined || candidate.phase === phase),
    );
    if (event != undefined) {
      seen.add(label);
      markers.push({ label, x: toX(event.monotonicTs), kind: "phase" });
    }
  };
  firstOf("layout.applied", "layout.applied");
  firstOf("open", "datasource.open", "start");
  firstOf("first message", "datasource.firstMessage");
  firstOf("first useful frame", "frame.firstUseful");
  firstOf("preload start", "preload", "start");
  firstOf("preload end", "preload", "end");
  firstOf("playback start", "playback", "start");
  firstOf("playback end", "playback", "end");
  const { panelsReadyMs, origin } = result.summary.phases;
  if (panelsReadyMs != undefined && origin != undefined) {
    markers.push({ label: "panels ready", x: round(panelsReadyMs / 1000), kind: "phase" });
  }
  for (const event of result.runnerEvents ?? []) {
    markers.push({ label: event.type, x: toX(event.monotonicTs), kind: "failure" });
  }
  return markers.sort((a, b) => a.x - b.x);
}

/** Chart series and markers of one run (x: seconds from the phases origin). */
export function buildRunChartData(result: PersistedResultV1): RunChartData {
  const origin = phasesOrigin(result.events);
  const originTs = origin?.ts ?? result.run.startMonotonicTs;
  const toX = (ts: number) => (ts - originTs) / 1000;
  const samples = result.samples;
  const charts = [
    memoryChart(samples, toX),
    heapChart(samples, toX),
    pipelineChart(samples, toX),
    cacheChart(samples, toX),
    poolChart(samples, toX),
    ...panelCharts(samples, toX),
  ].filter((chart): chart is ChartSpec => chart != undefined);
  return {
    // Whole seconds keep the shared axis ticks readable.
    xMin: Math.floor(toX(result.run.startMonotonicTs)),
    xMax: Math.ceil(toX(result.run.endMonotonicTs)),
    originLabel: origin?.origin ?? "run start",
    markers: phaseMarkers(result, originTs),
    charts,
  };
}
