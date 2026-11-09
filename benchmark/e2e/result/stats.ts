// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Pure statistics helpers shared by the v1 result builders (numeric sort, nearest-rank
// percentiles) and the telemetry overhead A/B (interpolated quantiles, IQR, exact order-statistic
// confidence interval of the median, tri-state verdicts). Free of DOM/Playwright/Node imports
// (compiled by the root tsconfig too).

import { MEDIAN_CI_CONFIDENCE, MIN_PAIRS_FOR_VERDICT, VERDICT_SEVERITY } from "./constants";
import type { ConfidenceInterval, MedianCiRanks, MetricStats, Verdict } from "./stats.types";

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

/**
 * Interquartile range `q75 − q25`, quantiles linearly interpolated between order statistics (R type
 * 7, the spreadsheet/NumPy default); undefined for no values.
 */
export function interquartileRange(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = sortedNumbers(values);
  return quantileOfSorted(sorted, 0.75) - quantileOfSorted(sorted, 0.25);
}

/**
 * `P(B ≤ k)` for `B ~ Binomial(n, 1/2)` (0 for `k < 0`, 1 for `k ≥ n`). The probabilities are
 * summed in log space, so large `n` does not underflow.
 */
export function binomialHalfCdf(k: number, n: number): number {
  if (k < 0) {
    return 0;
  }
  if (k >= n) {
    return 1;
  }
  let logPmf = n * Math.log(0.5);
  let cdf = Math.exp(logPmf);
  for (let i = 0; i < k; i++) {
    logPmf += Math.log((n - i) / (i + 1));
    cdf += Math.exp(logPmf);
  }
  return Math.min(cdf, 1);
}

/**
 * Ranks of the exact distribution-free confidence interval of the median of `n` values: the order
 * statistics `[x(k), x(n − k + 1)]` (1-based) contain the population median with probability
 * `1 − 2·P(B ≤ k − 1)`, `B ~ Binomial(n, 1/2)`, for any continuous distribution. The narrowest such
 * interval (largest `k`) whose coverage is at least `confidence`; undefined when even `[min, max]`
 * falls short (for 95 %: n < 6, as `[min, max]` covers `1 − 2^(1 − n)`, 93.75 % for n = 5).
 */
export function medianCiRanks(
  n: number,
  confidence: number = MEDIAN_CI_CONFIDENCE,
): MedianCiRanks | undefined {
  const coverage = (k: number) => 1 - 2 * binomialHalfCdf(k - 1, n);
  if (n < 1 || coverage(1) < confidence) {
    return undefined;
  }
  let k = 1;
  while (k + 1 <= n - k && coverage(k + 1) >= confidence) {
    k += 1;
  }
  return { lower: k, upper: n - k + 1, coverage: coverage(k) };
}

/**
 * Exact distribution-free 95 % confidence interval of the median (order statistics, see
 * `medianCiRanks`); undefined without enough values to reach 95 % (fewer than 6).
 */
export function medianCi95(values: readonly number[]): ConfidenceInterval | undefined {
  const ranks = medianCiRanks(values.length);
  if (ranks == undefined) {
    return undefined;
  }
  const sorted = sortedNumbers(values);
  return { lower: sorted[ranks.lower - 1]!, upper: sorted[ranks.upper - 1]! };
}

/**
 * Median, IQR and exact CI95 of the median (`medianCi95`, omitted below 6 values) of the finite
 * `values` (non-finite ones are ignored).
 */
export function summarizeMetric(values: ReadonlyArray<number | undefined>): MetricStats {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (finite.length === 0) {
    return { n: 0 };
  }
  const ci95 = medianCi95(finite);
  return {
    n: finite.length,
    median: median(finite),
    iqr: interquartileRange(finite),
    ...(ci95 != undefined && { ci95 }),
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
