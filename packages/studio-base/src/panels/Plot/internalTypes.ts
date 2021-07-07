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

import { TooltipItem } from "@foxglove/studio-base/components/TimeBasedChart";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

export type BasePlotPath = {
  value: string;
  enabled: boolean;
};

export type PlotPath = BasePlotPath & {
  timestampMethod: TimestampMethod;
};

export type PlotChartPoint = {
  x: number;
  y: number;
};

export type DataSet = {
  borderColor: string;
  borderWidth: number;
  data: Array<PlotChartPoint>;
  fill: boolean;
  key: string;
  label: string;
  pointBackgroundColor: string;
  pointBorderColor: string;
  pointHoverRadius: number;
  pointRadius: number;
  showLine: boolean;
};

export type PlotDataByPath = {
  [path: string]: readonly (readonly TooltipItem[])[];
};

// A "reference line" plot path is a numeric value. It creates a horizontal line on the plot at the specified value.
export function isReferenceLinePlotPathType(path: BasePlotPath): boolean {
  return !isNaN(Number.parseFloat(path.value));
}
