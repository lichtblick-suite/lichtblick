// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Pure helpers aggregating published telemetry series (counters / gauges / observations) for the
// v1 summaries.
// All helpers are independent of the input order. Free of DOM/Playwright/Node imports.

import { maxOf, percentile } from "./stats";
import { ObservationSummary } from "./types";
import type { TelemetrySample } from "../../../packages/suite-base/src/util/telemetry/types";
import { compareCodeUnits } from "../shared/compare";

/** Identity of a published series: realm + metric + labels (sorted by key). */
export function seriesKey(sample: TelemetrySample): string {
  let key = `${sample.realm}|${sample.metric}`;
  const labels = sample.labels;
  if (labels != undefined) {
    for (const name of Object.keys(labels).sort(compareCodeUnits)) {
      key += `|${name}=${labels[name]}`;
    }
  }
  return key;
}

/** Groups samples by metric name (input order is kept within each group). */
export function indexByMetric(
  samples: readonly TelemetrySample[],
): ReadonlyMap<string, readonly TelemetrySample[]> {
  const index = new Map<string, TelemetrySample[]>();
  for (const sample of samples) {
    let list = index.get(sample.metric);
    if (list == undefined) {
      list = [];
      index.set(sample.metric, list);
    }
    list.push(sample);
  }
  return index;
}

/**
 * Final total of a counter: per series the last cumulative value (counters are cumulative and
 * monotonic, so the maximum; robust to dropped intermediate publishes), summed over all series
 * (realms / label sets). Undefined when no sample was published.
 */
export function counterTotal(samples: readonly TelemetrySample[] | undefined): number | undefined {
  return counterTotalAt(samples, Infinity);
}

/**
 * Cumulative counter total as published at or before `ts`: per series the latest cumulative value
 * with `monotonicTs <= ts`, summed over series. Undefined when no sample qualifies.
 */
export function counterTotalAt(
  samples: readonly TelemetrySample[] | undefined,
  ts: number,
): number | undefined {
  const perSeries = new Map<string, number>();
  for (const sample of samples ?? []) {
    if (sample.monotonicTs > ts) {
      continue;
    }
    const key = seriesKey(sample);
    perSeries.set(key, Math.max(perSeries.get(key) ?? 0, sample.value));
  }
  if (perSeries.size === 0) {
    return undefined;
  }
  let total = 0;
  for (const value of perSeries.values()) {
    total += value;
  }
  return total;
}

/**
 * Peak of a gauge summed over its series: walking the publishes in time order, the sum of every
 * series' latest value is taken after each publish timestamp; the maximum of those sums is
 * returned. Equals the plain maximum for a single series. Undefined without samples.
 */
export function gaugePeakOfTotal(
  samples: readonly TelemetrySample[] | undefined,
): number | undefined {
  if (samples == undefined || samples.length === 0) {
    return undefined;
  }
  const byTs = new Map<number, TelemetrySample[]>();
  for (const sample of samples) {
    let list = byTs.get(sample.monotonicTs);
    if (list == undefined) {
      list = [];
      byTs.set(sample.monotonicTs, list);
    }
    list.push(sample);
  }
  const latest = new Map<string, number>();
  let peak: number | undefined;
  for (const ts of [...byTs.keys()].sort((a, b) => a - b)) {
    for (const sample of byTs.get(ts)!) {
      latest.set(seriesKey(sample), sample.value);
    }
    let total = 0;
    for (const value of latest.values()) {
      total += value;
    }
    peak = peak == undefined || total > peak ? total : peak;
  }
  return peak;
}

/** Metric names published by the sink for one `observe()` series. */
export function observationMetrics(metric: string): { count: string; sum: string; max: string } {
  return { count: `${metric}.count`, sum: `${metric}.sum`, max: `${metric}.max` };
}

/**
 * Summarizes an `observe()` series from its published `.count` / `.sum` counters and per-window
 * `.max` gauge (only non-empty windows are published, so every `.max` sample is one window).
 * Undefined when none of the three was published.
 */
export function summarizeObservation(
  metrics: ReadonlyMap<string, readonly TelemetrySample[]>,
  metric: string,
): ObservationSummary | undefined {
  const names = observationMetrics(metric);
  const count = counterTotal(metrics.get(names.count));
  const sum = counterTotal(metrics.get(names.sum));
  const windowMaxima = (metrics.get(names.max) ?? []).map((sample) => sample.value);
  if (count == undefined && sum == undefined && windowMaxima.length === 0) {
    return undefined;
  }
  const summary: ObservationSummary = { count: count ?? 0, sum: sum ?? 0 };
  if (summary.count > 0) {
    summary.mean = summary.sum / summary.count;
  }
  if (windowMaxima.length > 0) {
    summary.max = maxOf(windowMaxima)!;
    summary.p90WindowMax = percentile(windowMaxima, 90)!;
  }
  return summary;
}
