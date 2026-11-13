// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ALLOWED_TELEMETRY_LABEL_KEYS, DEFAULT_MAX_SERIES_PER_METRIC } from "./constants";
import { TelemetryLabels, TelemetryRejectReason } from "./types";

/**
 * Orders strings by UTF-16 code units, like `Array#sort` without a comparator. Locale independent,
 * so series keys stay byte-stable across environments (unlike `localeCompare`).
 */
function compareCodeUnits(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

// Series keys of frozen label objects, per metric. Callers reuse frozen labels (pool, panel and
// player labels), so the sort + stringify below runs once per (labels, metric) pair instead of on
// every call. Entries are released together with the label objects.
const seriesKeysByFrozenLabels = new WeakMap<TelemetryLabels, Map<string, string>>();

function computeSeriesKey(metric: string, labels: TelemetryLabels): string {
  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return metric;
  }
  keys.sort(compareCodeUnits);
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
 * Builds the identity of a series: the metric (or event) name followed by its labels sorted by
 * key, e.g. `pool.bytes{poolId="a",sourceId="b"}`. Values are JSON-quoted so different label
 * sets can never produce the same key.
 *
 * The no-label case (undefined or `{}`) returns `metric` itself without building a string. Keys of
 * frozen label objects are cached per metric; unfrozen labels are rebuilt on every call, so a
 * caller mutating its labels object can never get a stale key.
 */
export function buildSeriesKey(metric: string, labels: TelemetryLabels | undefined): string {
  if (labels == undefined) {
    return metric;
  }
  if (!Object.isFrozen(labels)) {
    return computeSeriesKey(metric, labels);
  }
  let keysByMetric = seriesKeysByFrozenLabels.get(labels);
  const cached = keysByMetric?.get(metric);
  if (cached != undefined) {
    return cached;
  }
  const key = computeSeriesKey(metric, labels);
  if (keysByMetric == undefined) {
    keysByMetric = new Map();
    seriesKeysByFrozenLabels.set(labels, keysByMetric);
  }
  keysByMetric.set(metric, key);
  return key;
}

/**
 * Bounded-cardinality guard: enforces the label key allow-list and caps the number of distinct
 * label sets per metric (or event name) to `maxSeriesPerMetric`.
 *
 * The cap is per metric name, not per realm: a sink's guard is shared with the records it ingests
 * from other realms, and monotonic label values (`poolId`, `realm`) count towards it. A series
 * beyond the cap is rejected (reason "cardinality") rather than evicting an existing one, so the
 * total stays bounded however many realms report.
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
  ): Exclude<TelemetryRejectReason, "invalidValue" | "reservedName"> | undefined {
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
