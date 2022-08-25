// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { BasePlotPath, PlotPath } from "@foxglove/studio-base/panels/Plot/internalTypes";

// X-axis values:
export type PlotXAxisVal =
  | "timestamp" // Message playback time. Preloaded.
  | "index" // Message-path value index. One "current" message at playback time.
  | "custom" // Message path data. Preloaded.
  | "currentCustom"; // Message path data. One "current" message at playback time.

type DeprecatedPlotConfig = {
  showSidebar?: boolean;
  sidebarWidth?: number;
};
export type PlotConfig = DeprecatedPlotConfig & {
  title?: string;
  paths: PlotPath[];
  minXValue?: number;
  maxXValue?: number;
  minYValue?: string | number;
  maxYValue?: string | number;
  showLegend: boolean;
  legendDisplay: "floating" | "top" | "left";
  showPlotValuesInLegend: boolean;
  showXAxisLabels: boolean;
  showYAxisLabels: boolean;
  isSynced: boolean;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  followingViewWidth?: number;
  sidebarDimension: number;
};

export const plotableRosTypes = [
  "bool",
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
  "float32",
  "float64",
  "time",
  "duration",
  "string",
  "json",
];
