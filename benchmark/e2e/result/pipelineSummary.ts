// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Summary of the pipeline telemetry (`summary.pipeline`). Pure; free of
// DOM/Playwright/Node imports (compiled by the root tsconfig too).

import { PIPELINE_MEMORY_METRIC_PREFIX, PIPELINE_METRICS } from "./constants";
import {
  counterTotal,
  counterTotalAt,
  gaugePeakOfTotal,
  indexByMetric,
  summarizeObservation,
} from "./series";
import { maxOf } from "./stats";
import { PipelineWindow } from "./types";
import type { TelemetrySample } from "../../../packages/suite-base/src/util/telemetry/types";

/** Every field is omitted when the run published no data for it. */
export type PipelineSummaryV1 = {
  /** Final `pipeline.messages.received` total (whole run). */
  messagesReceived?: number;
  /** Final `pipeline.messages.receivedBytes` total (whole run). */
  bytesReceived?: number;
  /** Span the rates below were computed over (see `pipelineRateWindow`). */
  rateWindowMs?: number;
  /** `pipeline.messages.received` increase over the measured window, per second. */
  messagesPerSec?: number;
  /** `pipeline.messages.receivedBytes` increase over the measured window, per second. */
  bytesPerSec?: number;
  /** `pipeline.messages.delivered / pipeline.messages.received` (whole run). */
  deliveredFanout?: number;
  subscribersMax?: number;
  subscriptionsMax?: number;
  /** `pipeline.listenerDispatchDurationMs`: Σsum / Σcount over the run. */
  listenerDispatchMeanMs?: number;
  /** `pipeline.listenerDispatchDurationMs`: maximum of the per-window `.max`. */
  listenerDispatchMaxMs?: number;
  /** `pipeline.listenerDispatchDurationMs`: p90 of the per-window `.max` (spike indicator). */
  listenerDispatchP90WindowMaxMs?: number;
  blockCachePeakBytes?: number;
  blockCacheMaxBytes?: number;
  blockCacheEvictions?: number;
  sourceCacheHits?: number;
  sourceCacheMisses?: number;
  /** `hits / (hits + misses)`; omitted when there were no lookups. */
  sourceCacheHitRatio?: number;
  sourceCachePeakBytes?: number;
  remoteReadRequests?: number;
  remoteBytesRead?: number;
  /** Peak of the (summed over realms) `pipeline.sources.total` gauge. */
  sourcesTotal?: number;
  /** Peak of the (summed over realms) `pipeline.sources.relevant` gauge. */
  sourcesRelevant?: number;
  /**
   * Peak per `pipeline.memory.<key>` gauge, keyed `<key>` or `<key>/<sourceId>` when the series has a
   * `sourceId` label (e.g. `bufferedMessages/mcap-real-pipeline`).
   */
  memoryPeakBytes?: Record<string, number>;
};

/** Sorted, de-duplicated publish timestamps per realm (every gauge is republished each tick). */
function publishTimesByRealm(samples: readonly TelemetrySample[]): Map<string, number[]> {
  const byRealm = new Map<string, Set<number>>();
  for (const sample of samples) {
    let set = byRealm.get(sample.realm);
    if (set == undefined) {
      set = new Set();
      byRealm.set(sample.realm, set);
    }
    set.add(sample.monotonicTs);
  }
  const result = new Map<string, number[]>();
  for (const [realm, set] of byRealm) {
    result.set(
      realm,
      [...set].sort((a, b) => a - b),
    );
  }
  return result;
}

function latestAtOrBefore(sortedTimes: readonly number[], ts: number): number | undefined {
  let result: number | undefined;
  for (const time of sortedTimes) {
    if (time > ts) {
      break;
    }
    result = time;
  }
  return result;
}

/**
 * Snaps the measured window to the publish grid of the realms producing `counterSamples`: the end
 * becomes the last publish at or before `measured.endTs` (counter values are only known at
 * publishes), the start the last publish at or before `measured.startTs` (or `measured.startTs` when the
 * realm had not published yet). Undefined when the snapped window is empty.
 */
export function pipelineRateWindow(
  counterSamples: readonly TelemetrySample[],
  allSamples: readonly TelemetrySample[],
  measured: PipelineWindow,
): PipelineWindow | undefined {
  const realms = new Set(counterSamples.map((sample) => sample.realm));
  const grid: number[] = [];
  for (const [realm, times] of publishTimesByRealm(allSamples)) {
    if (realms.has(realm)) {
      grid.push(...times);
    }
  }
  grid.sort((a, b) => a - b);
  const endTs = latestAtOrBefore(grid, measured.endTs);
  const startTs = latestAtOrBefore(grid, measured.startTs) ?? measured.startTs;
  if (endTs == undefined || endTs <= startTs) {
    return undefined;
  }
  return { startTs, endTs };
}

/** Counter increase over `window`, per second. */
function ratePerSec(samples: readonly TelemetrySample[], measured: PipelineWindow): number {
  const increase =
    (counterTotalAt(samples, measured.endTs) ?? 0) -
    (counterTotalAt(samples, measured.startTs) ?? 0);
  return increase / ((measured.endTs - measured.startTs) / 1000);
}

function memoryPeaks(samples: readonly TelemetrySample[]): Record<string, number> | undefined {
  const byKey = new Map<string, TelemetrySample[]>();
  for (const sample of samples) {
    if (!sample.metric.startsWith(PIPELINE_MEMORY_METRIC_PREFIX)) {
      continue;
    }
    const name = sample.metric.slice(PIPELINE_MEMORY_METRIC_PREFIX.length);
    const sourceId = sample.labels?.sourceId;
    const key = sourceId == undefined ? name : `${name}/${sourceId}`;
    let list = byKey.get(key);
    if (list == undefined) {
      list = [];
      byKey.set(key, list);
    }
    list.push(sample);
  }
  if (byKey.size === 0) {
    return undefined;
  }
  const peaks: Record<string, number> = {};
  for (const key of [...byKey.keys()].sort((a, b) => a.localeCompare(b))) {
    peaks[key] = gaugePeakOfTotal(byKey.get(key))!;
  }
  return peaks;
}

/**
 * Builds `summary.pipeline` from the page samples (all realms). Counter totals are the last
 * cumulative value per series summed over series; gauge peaks are the peak of the per-publish sum
 * over series. Rates use the counter increase over the `measured` window snapped to the producing
 * realm's publish grid (`pipelineRateWindow`). Undefined when the run has no pipeline data.
 */
export function summarizePipeline(
  pageSamples: readonly TelemetrySample[],
  measured: PipelineWindow,
): PipelineSummaryV1 | undefined {
  const metrics = indexByMetric(pageSamples);
  const series = (metric: string) => metrics.get(metric);
  const summary: PipelineSummaryV1 = {};
  const set = <K extends keyof PipelineSummaryV1>(key: K, value: PipelineSummaryV1[K]) => {
    if (value != undefined) {
      summary[key] = value;
    }
  };

  const receivedSamples = series(PIPELINE_METRICS.messagesReceived) ?? [];
  const received = counterTotal(receivedSamples);
  const delivered = counterTotal(series(PIPELINE_METRICS.messagesDelivered));
  set("messagesReceived", received);
  set("bytesReceived", counterTotal(series(PIPELINE_METRICS.messagesReceivedBytes)));
  const rateWindow =
    receivedSamples.length > 0
      ? pipelineRateWindow(receivedSamples, pageSamples, measured)
      : undefined;
  if (rateWindow != undefined) {
    set("rateWindowMs", rateWindow.endTs - rateWindow.startTs);
    set("messagesPerSec", ratePerSec(receivedSamples, rateWindow));
    const bytesSamples = series(PIPELINE_METRICS.messagesReceivedBytes);
    if (bytesSamples != undefined) {
      set("bytesPerSec", ratePerSec(bytesSamples, rateWindow));
    }
  }
  if (received != undefined && received > 0 && delivered != undefined) {
    set("deliveredFanout", delivered / received);
  }

  set("subscribersMax", gaugePeakOfTotal(series(PIPELINE_METRICS.subscribersCount)));
  set("subscriptionsMax", gaugePeakOfTotal(series(PIPELINE_METRICS.subscriptionsCount)));
  const dispatch = summarizeObservation(metrics, PIPELINE_METRICS.listenerDispatchDurationMs);
  set("listenerDispatchMeanMs", dispatch?.mean);
  set("listenerDispatchMaxMs", dispatch?.max);
  set("listenerDispatchP90WindowMaxMs", dispatch?.p90WindowMax);

  set("blockCachePeakBytes", gaugePeakOfTotal(series(PIPELINE_METRICS.blockCacheBytes)));
  set(
    "blockCacheMaxBytes",
    maxOf((series(PIPELINE_METRICS.blockCacheMaxBytes) ?? []).map((sample) => sample.value)),
  );
  set("blockCacheEvictions", counterTotal(series(PIPELINE_METRICS.blockCacheEvictions)));

  const hits = counterTotal(series(PIPELINE_METRICS.sourceCacheHits));
  const misses = counterTotal(series(PIPELINE_METRICS.sourceCacheMisses));
  set("sourceCacheHits", hits);
  set("sourceCacheMisses", misses);
  const lookups = (hits ?? 0) + (misses ?? 0);
  if (lookups > 0) {
    set("sourceCacheHitRatio", (hits ?? 0) / lookups);
  }
  set("sourceCachePeakBytes", gaugePeakOfTotal(series(PIPELINE_METRICS.sourceCacheBytes)));

  set("remoteReadRequests", counterTotal(series(PIPELINE_METRICS.remoteReadRequests)));
  set("remoteBytesRead", counterTotal(series(PIPELINE_METRICS.remoteBytesRead)));
  set("sourcesTotal", gaugePeakOfTotal(series(PIPELINE_METRICS.sourcesTotal)));
  set("sourcesRelevant", gaugePeakOfTotal(series(PIPELINE_METRICS.sourcesRelevant)));
  set("memoryPeakBytes", memoryPeaks(pageSamples));

  return Object.keys(summary).length > 0 ? summary : undefined;
}
