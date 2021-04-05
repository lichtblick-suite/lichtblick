// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ScatterDataPoint } from "chart.js";

export type RpcScale = { min: number; max: number; left: number; right: number };

export type RpcScales = Record<string, { min: number; max: number; left: number; right: number }>;

export type RpcElement = {
  data?: ScatterDataPoint;
  view: {
    x: number;
    y: number;
  };
};
