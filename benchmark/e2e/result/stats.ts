// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Pure statistics helpers shared by the v1 result builders (numeric sort, nearest-rank
// percentiles) and the telemetry overhead A/B (interpolated quantiles, IQR, seeded percentile
// bootstrap of the median, tri-state verdicts). Free of DOM/Playwright/Node imports (compiled by
// the root tsconfig too).

import {
  BOOTSTRAP_RESAMPLES,
  BOOTSTRAP_SEED,
  CI95_LOWER_QUANTILE,
  CI95_UPPER_QUANTILE,
  MIN_PAIRS_FOR_VERDICT,
  VERDICT_SEVERITY,
} from "./constants";
import type { BootstrapOptions, ConfidenceInterval, MetricStats, Verdict } from "./stats.types";

function sortedNumbers(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/** Nearest-rank percentile (`p` in [0, 100]) after a numeric sort; undefined for no values. */
export function percentile(values: readonly number[], p: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = sortedNumbers(values);
  const rank = Math.ceil((Math.min(Math.max(p, 0), 100) / 100) * sorted.length);
  return sorted[Math.max(rank, 1) - 1];
}

/** Median (mean of the two middle values for even counts); undefined for no values. */
export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = sortedNumbers(values);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
}

export function maxOf(values: readonly number[]): number | undefined {
  let result: number | undefined;
  for (const value of values) {
    result = result == undefined || value > result ? value : result;
  }
  return result;
}

/** Quantile `q` ∈ [0, 1] of ascending `sorted` (non-empty) by linear interpolation between ranks. */
function quantileOfSorted(sorted: ArrayLike<number>, q: number): number {
  const position = Math.min(Math.max(q, 0), 1) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(lowerIndex + 1, sorted.length - 1);
  const lower = sorted[lowerIndex]!;
  return lower + (position - lowerIndex) * (sorted[upperIndex]! - lower);
}

/** Median of ascending `sorted` (non-empty). */
function medianOfSorted(sorted: ArrayLike<number>): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Quantile `q` ∈ [0, 1] with linear interpolation between order statistics (R type 7, the
 * spreadsheet/NumPy default); undefined for no values.
 */
export function quantile(values: readonly number[], q: number): number | undefined {
  return values.length === 0 ? undefined : quantileOfSorted(sortedNumbers(values), q);
}

/** Interquartile range `q75 − q25` (see `quantile`); undefined for no values. */
export function interquartileRange(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = sortedNumbers(values);
  return quantileOfSorted(sorted, 0.75) - quantileOfSorted(sorted, 0.25);
}

/**
 * Mulberry32: a small, fast 32-bit seeded PRNG returning floats in [0, 1). Deterministic per seed,
 * which keeps bootstrap intervals reproducible (not for cryptographic use).
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Percentile bootstrap 95 % confidence interval of the median: `resamples` resamples of `values`
 * with replacement (seeded, so deterministic), the median of each, then the 2.5th and 97.5th
 * percentiles of those medians. One value yields `[value, value]`; no values, undefined. Buffers
 * are allocated once (no allocation per resample).
 */
export function bootstrapMedianCi95(
  values: readonly number[],
  { resamples = BOOTSTRAP_RESAMPLES, seed = BOOTSTRAP_SEED }: BootstrapOptions = {},
): ConfidenceInterval | undefined {
  const n = values.length;
  if (n === 0) {
    return undefined;
  }
  if (n === 1 || resamples < 1) {
    const only = medianOfSorted(sortedNumbers(values));
    return { lower: only, upper: only };
  }
  const random = mulberry32(seed);
  const resample = new Float64Array(n);
  const medians = new Float64Array(resamples);
  for (let b = 0; b < resamples; b++) {
    for (let i = 0; i < n; i++) {
      resample[i] = values[Math.floor(random() * n)]!;
    }
    resample.sort();
    medians[b] = medianOfSorted(resample);
  }
  medians.sort();
  return {
    lower: quantileOfSorted(medians, CI95_LOWER_QUANTILE),
    upper: quantileOfSorted(medians, CI95_UPPER_QUANTILE),
  };
}

/** Median, IQR and bootstrap CI95 of the finite `values` (non-finite ones are ignored). */
export function summarizeMetric(
  values: ReadonlyArray<number | undefined>,
  options: BootstrapOptions = {},
): MetricStats {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (finite.length === 0) {
    return { n: 0 };
  }
  return {
    n: finite.length,
    median: median(finite),
    iqr: interquartileRange(finite),
    ci95: bootstrapMedianCi95(finite, options),
  };
}

/**
 * Tri-state target check (`Verdict`): `within` when `ci.upper ≤ target`, `exceeds` when
 * `ci.lower > target`, else `inconclusive`. Always `inconclusive` without an interval or with
 * fewer than `minN` samples (`n`; default `MIN_PAIRS_FOR_VERDICT`).
 */
export function verdict(
  ci: ConfidenceInterval | undefined,
  target: number,
  n: number,
  minN: number = MIN_PAIRS_FOR_VERDICT,
): Verdict {
  if (ci == undefined || n < minN) {
    return "inconclusive";
  }
  if (ci.upper <= target) {
    return "within";
  }
  return ci.lower > target ? "exceeds" : "inconclusive";
}

/** The most severe verdict (`exceeds` > `inconclusive` > `within`); `inconclusive` for none. */
export function worstVerdict(verdicts: readonly Verdict[]): Verdict {
  let worst: Verdict | undefined;
  for (const candidate of verdicts) {
    if (worst == undefined || VERDICT_SEVERITY[candidate] > VERDICT_SEVERITY[worst]) {
      worst = candidate;
    }
  }
  return worst ?? "inconclusive";
}
