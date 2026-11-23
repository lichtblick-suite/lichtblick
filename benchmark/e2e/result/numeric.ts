// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Pure numeric helpers of the v1 result summaries (trends and integrals of 1 Hz host series).
// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too).

import type { NumericPoint } from "./types";

/**
 * Ordinary least-squares slope of `y` over `x` (units of y per unit of x). Undefined with fewer
 * than 2 points or when every `x` is equal (no x variance). Order of `points` does not matter.
 */
export function linearRegressionSlope(points: readonly NumericPoint[]): number | undefined {
  const count = points.length;
  if (count < 2) {
    return undefined;
  }
  let sumX = 0;
  let sumY = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / count;
  const meanY = sumY / count;
  let covariance = 0;
  let varianceX = 0;
  for (const { x, y } of points) {
    const dx = x - meanX;
    covariance += dx * (y - meanY);
    varianceX += dx * dx;
  }
  return varianceX === 0 ? undefined : covariance / varianceX;
}

/**
 * Trapezoidal integral of `y` over `x` between the first and the last point (units of y × x).
 * `points` must be sorted by `x`; 0 with fewer than 2 points.
 */
export function trapezoidIntegral(points: readonly NumericPoint[]): number {
  let area = 0;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    area += ((previous.y + current.y) / 2) * (current.x - previous.x);
  }
  return area;
}

/**
 * Geometric mean of the usable values (finite and > 0; others are ignored) and how many were used.
 * `value` is undefined when none is usable. Computed in log space (no overflow on long lists).
 */
export function geometricMean(values: ReadonlyArray<number | undefined>): {
  value?: number;
  n: number;
} {
  let logSum = 0;
  let n = 0;
  for (const value of values) {
    if (value != undefined && Number.isFinite(value) && value > 0) {
      logSum += Math.log(value);
      n++;
    }
  }
  return n === 0 ? { n } : { value: Math.exp(logSum / n), n };
}
