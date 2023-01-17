// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ScatterDataPoint } from "chart.js";

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
  data?: ScatterDataPoint;
  datasetIndex: number;
  view: {
    x: number;
    y: number;
  };
};
