// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too).

/** Two-sided confidence interval (`lower ≤ upper`). */
export type ConfidenceInterval = { lower: number; upper: number };

/**
 * Tri-state target check of a statistic with a confidence interval (`verdict`):
 * - `within`: the whole interval is at or below the target;
 * - `exceeds`: the whole interval is above the target;
 * - `inconclusive`: the interval straddles the target, or too few samples for a verdict.
 */
export type Verdict = "within" | "exceeds" | "inconclusive";

/**
 * Distribution summary of repeated measurements (e.g. A/B pair deltas). `n` counts the finite
 * values; every other field is omitted without values, and `ci95` also with fewer than 6 values
 * (no distribution-free 95 % interval of the median exists below that).
 */
export type MetricStats = {
  n: number;
  median?: number;
  /** Interquartile range (`q75 − q25`, linear interpolation). */
  iqr?: number;
  /** Exact distribution-free (order-statistic) 95 % confidence interval of the median. */
  ci95?: ConfidenceInterval;
};

/** 1-based ranks of the order statistics bounding a median confidence interval (`medianCiRanks`). */
export type MedianCiRanks = {
  lower: number;
  upper: number;
  /** Exact coverage probability of `[x(lower), x(upper)]` for the population median. */
  coverage: number;
};
