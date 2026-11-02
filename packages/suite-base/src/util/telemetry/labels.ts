// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ALLOWED_TELEMETRY_LABEL_KEYS, DEFAULT_MAX_SERIES_PER_METRIC } from "./constants";
import { TelemetryLabels, TelemetryRejectReason } from "./types";

/**
 * Builds the identity of a series: the metric (or event) name followed by its labels sorted by
 * key, e.g. `pool.bytes{poolId="a",sourceId="b"}`. Values are JSON-quoted so different label
 * sets can never produce the same key.
 *
 * The no-label case (undefined or `{}`) returns `metric` itself without building a string.
 */
export function buildSeriesKey(metric: string, labels: TelemetryLabels | undefined): string {
  if (labels == undefined) {
    return metric;
  }
  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return metric;
  }
  keys.sort();
  let key = metric + "{";
  for (let i = 0; i < keys.length; i++) {
    const labelKey = keys[i]!;
    if (i > 0) {
      key += ",";
    }
    key += `${labelKey}=${JSON.stringify(labels[labelKey])}`;
  }
  return key + "}";
}

/**
 * Bounded-cardinality guard: enforces the label key allow-list and caps the number of distinct
 * label sets per metric (or event name) to `maxSeriesPerMetric`.
 */
export class TelemetryLabelGuard {
  readonly #maxSeriesPerMetric: number;
  readonly #seriesByMetric = new Map<string, Set<string>>();

  public constructor(maxSeriesPerMetric: number = DEFAULT_MAX_SERIES_PER_METRIC) {
    if (!Number.isInteger(maxSeriesPerMetric) || maxSeriesPerMetric < 1) {
      throw new Error(`maxSeriesPerMetric must be a positive integer, got ${maxSeriesPerMetric}`);
    }
    this.#maxSeriesPerMetric = maxSeriesPerMetric;
  }

  /**
   * Checks whether the series `seriesKey` (built with `buildSeriesKey(metric, labels)`) may be
   * recorded. Admitted series are remembered so subsequent checks are a pair of lookups.
   *
   * @returns `undefined` when admitted, otherwise the rejection reason.
   */
  public admit(
    metric: string,
    seriesKey: string,
    labels: TelemetryLabels | undefined,
  ): Exclude<TelemetryRejectReason, "invalidValue"> | undefined {
    const known = this.#seriesByMetric.get(metric);
    if (known?.has(seriesKey) === true) {
      return undefined;
    }
    if (labels != undefined) {
      const keys = Object.keys(labels);
      for (const key of keys) {
        if (!ALLOWED_TELEMETRY_LABEL_KEYS.has(key)) {
          return "unknownLabel";
        }
      }
    }
    if (known == undefined) {
      this.#seriesByMetric.set(metric, new Set([seriesKey]));
      return undefined;
    }
    if (known.size >= this.#maxSeriesPerMetric) {
      return "cardinality";
    }
    known.add(seriesKey);
    return undefined;
  }

  /** Forgets all admitted series. */
  public clear(): void {
    this.#seriesByMetric.clear();
  }
}
