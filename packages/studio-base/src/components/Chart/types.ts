// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ScatterDataPoint, ChartData as ChartJsChartData } from "chart.js";

// Chartjs typings use _null_ to indicate _gaps_ in the dataset
// eslint-disable-next-line no-restricted-syntax
const ChartNull = null;
type Datum = ScatterDataPoint & {
  // chart.js supported properties to show a label above the datapoint
  // used by the state transition panel to show a label above the transition datum
  label?: string;
  labelColor?: string;

  // Our additional properties
  // value is the original value (rather than the plot x/y value) for the datum (used by state transitions)
  value?: string | number | bigint | boolean;
  // Constant name for the datum (used by state transitions)
  constantName?: string | undefined;
};
export type ChartData = ChartJsChartData<"scatter", (Datum | typeof ChartNull)[]>;

export type RpcScale = {
  // min scale value
  min: number;
  // max scale value
  max: number;
  // pixel coordinate within the component that corresponds to min
  pixelMin: number;
  // pixel coordinate within the component that corresponds to max
  pixelMax: number;
};

export type RpcScales = {
  x?: RpcScale;
  y?: RpcScale;
};

export type RpcElement = {
  data?: Datum;
  datasetIndex: number;
  index: number;
  view: {
    x: number;
    y: number;
  };
};
