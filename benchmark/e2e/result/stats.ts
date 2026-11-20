// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Pure statistics helpers shared by the v1 result builders (numeric sort, nearest-rank
// percentiles, median, mean, max). Free of DOM/Playwright/Node imports (compiled by the root
// tsconfig too).

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
