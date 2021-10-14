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

import { TimeBasedChartTooltipData } from "@foxglove/studio-base/components/TimeBasedChart";

import { PlotChartPoint } from "./internalTypes";

export type MathFunction = (arg0: number) => number;

export function derivative(
  data: PlotChartPoint[],
  tooltips: TimeBasedChartTooltipData[],
): { points: PlotChartPoint[]; tooltips: TimeBasedChartTooltipData[] } {
  const points = [];
  const newTooltips = [];
  for (let i = 1; i < data.length; i++) {
    const item = data[i] as PlotChartPoint;
    const prevItem = data[i - 1] as PlotChartPoint;
    const secondsDifference = item.x - prevItem.x;
    const value = (item.y - prevItem.y) / secondsDifference;
    const previousTooltip = tooltips[i];
    const point: PlotChartPoint = { x: item.x, y: value };
    if (!previousTooltip) {
      continue;
    }

    const tooltip = {
      x: point.x,
      y: point.y,
      item: previousTooltip.item,
      path: `${previousTooltip.path}.@derivative`,
      datasetKey: previousTooltip.datasetKey,
      value,
      constantName: undefined,
      startTime: previousTooltip.startTime,
    };
    newTooltips.push(tooltip);
    points.push(point);
  }
  return { points, tooltips: newTooltips };
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

// Apply a function to the y-value of the data or tooltips passed in.
export function applyToDataOrTooltips<T extends { y: number | string | bigint }>(
  dataOrTooltips: T[],
  func: (arg0: number) => number,
): T[] {
  return dataOrTooltips.map((item) => {
    let { y } = item;
    const numericYValue: number = Number(y);
    // Only apply the function if the Y value is a valid number.
    if (!isNaN(numericYValue)) {
      y = func(numericYValue);
    }
    return { ...item, y };
  });
}
