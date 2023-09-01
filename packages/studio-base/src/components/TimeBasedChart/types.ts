// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { ChartData as AbstractChartData } from "chart.js";

import type {
  ObjectData,
  ChartData,
  TypedChartData,
  TypedData,
} from "@foxglove/studio-base/components/Chart/types";

// alias types for convenience
export type ChartDatasets = ChartData["datasets"];
export type ChartDataset = ChartDatasets[0];
export type ChartDatum = ChartDataset["data"][0];

export type TypedChartDatasets = TypedChartData["datasets"];
export type TypedChartDataset = TypedChartDatasets[0];

export type Bounds = {
  x: { min: number; max: number };
  y: { min: number; max: number };
};

/**
 * PlotViewport represents the visible region of a plot in terms of its axes
 * and its dimensions on the screen.
 */
export type PlotViewport = {
  // the dimensions of the plot in screen space
  width: number; // px
  height: number; // px
  // and its axes
  bounds: Bounds;
};

export type ProviderState<T> = {
  data: AbstractChartData<"scatter", T>;
  // the bounds of the data contained in the `data` field
  bounds: Bounds;
};
export type ChartProviderState = ProviderState<ObjectData>;
export type TypedProviderState = ProviderState<TypedData[]>;

export type ProviderStateSetter<T> = (state: ProviderState<T>) => void;

/**
 * PlotDataProvider gives the user of a TimeBasedChart more granular control
 * over the data the plot displays, including giving it access to the current
 * viewport.
 */
export type PlotDataProvider<T> = {
  setView: (view: PlotViewport) => void;
  register: (setter: ProviderStateSetter<T>, addPartial: ProviderStateSetter<T>) => void;
};

export type ObjectDataProvider = PlotDataProvider<ObjectData>;
export type TypedDataProvider = PlotDataProvider<TypedData[]>;

export type { ChartData };
