// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Interolates betweem min and max. A value of 0 returns min and a value of
 * 1 returns max.
 */
export function interpolateValue(value: number, min: number, max: number): number {
  return min + (max - min) * value;
}

/**
 * Scales value from its position in the range minA, maxA to the range
 * minB, maxB. A value of minA will return minB, A value of maxA will return maxB.
 */
export function scaleValue(
  value: number,
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
): number {
  return interpolateValue((value - minA) / (maxA - minA), minB, maxB);
}
