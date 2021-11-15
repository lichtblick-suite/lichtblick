// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

export type MathFunction = (arg: number) => number;

export function derivative<T extends { x: number; y: number; path: string }>(data: T[]): T[] {
  const newDatums = [];
  for (let i = 1; i < data.length; i++) {
    const item = data[i]!;
    const prevItem = data[i - 1]!;
    const secondsDifference = item.x - prevItem.x;
    const value = (item.y - prevItem.y) / secondsDifference;
    newDatums.push({
      ...item,
      y: value,
      value,
      path: `${item.path}.@derivative`,
    });
  }
  return newDatums;
}

export const mathFunctions: { [fn: string]: MathFunction } = {
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  ceil: Math.ceil,
  cos: Math.cos,
  log: Math.log,
  log1p: Math.log1p,
  log2: Math.log2,
  log10: Math.log10,
  round: Math.round,
  sign: Math.sign,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
  trunc: Math.trunc,
  negative: (value: number) => -value,
  deg2rad: (degrees: number) => degrees * (Math.PI / 180),
  rad2deg: (radians: number) => radians * (180 / Math.PI),
};

export function applyToDatum<T extends { y: number | string | bigint; path: string }>(
  datum: T,
  func: MathFunction,
): T {
  let { y } = datum;
  const numericYValue: number = Number(y);
  // Only apply the function if the Y value is a valid number.
  if (!isNaN(numericYValue)) {
    y = func(numericYValue);
  }
  return { ...datum, y, value: y, path: `${datum.path}.@${func.name}` };
}
