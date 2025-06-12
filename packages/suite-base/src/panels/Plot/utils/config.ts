// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@lichtblick/rostime";
import { Immutable } from "@lichtblick/suite";
import { MessagePathDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { MessageEvent } from "@lichtblick/suite-base/players/types";
import { PANEL_TITLE_CONFIG_KEY } from "@lichtblick/suite-base/util/layout";
import { TimestampMethod } from "@lichtblick/suite-base/util/time";

export type Messages = Record<string, MessageEvent[]>;

export type BasePlotPath = {
  value: string;
  enabled: boolean;
};

export type PlotPath = BasePlotPath & {
  color?: string;
  label?: string;
  timestampMethod: TimestampMethod;
  showLine?: boolean;
  lineSize?: number;
};

export type PlotXAxisVal =
  // x-axis is either receive time since start or header stamp since start
  | "timestamp"
  // The message path values from the latest message for each series. The x-axis is the array
  // "index" of the item and y-axis is the item value
  | "index"
  // The x-axis are values from message path items (accumulated). Each series produces y-values from
  // its message path items. The x/y values are paired by their respective array index locations.
  | "custom"
  // Similar to "index" mode except the x-axis the message path item values and the y-axis are the
  // correspondible series message path value at the same array index. Only the latest message is used
  // for x-axis and each series
  | "currentCustom";

export type PlotDataItem = {
  queriedData: MessagePathDataItem[];
  receiveTime: Time;
  headerStamp?: Time;
};

/**
 * A "reference line" plot path is a numeric value. It creates a horizontal line on the plot at the
 * specified value.
 * @returns true if the series config is a reference line
 */
export function isReferenceLinePlotPathType(path: Immutable<PlotPath>): boolean {
  return !isNaN(Number.parseFloat(path.value));
}

/**
 * Coalesces null, undefined and empty string to undefined.
 */
function presence<T>(value: undefined | T): undefined | T {
  if (value === "") {
    return undefined;
  }

  return value ?? undefined;
}

export function plotPathDisplayName(path: Readonly<PlotPath>, index: number): string {
  return presence(path.label) ?? presence(path.value) ?? `Series ${index + 1}`;
}
type DeprecatedPlotConfig = {
  showSidebar?: boolean;
  sidebarWidth?: number;
};

export type PlotLegendDisplay = "floating" | "top" | "left" | "none";

export type PlotConfig = DeprecatedPlotConfig & {
  paths: PlotPath[];
  minXValue?: number;
  maxXValue?: number;
  minYValue?: string | number;
  maxYValue?: string | number;
  showLegend: boolean;
  legendDisplay: PlotLegendDisplay;
  showPlotValuesInLegend: boolean;
  showXAxisLabels: boolean;
  showYAxisLabels: boolean;
  isSynced: boolean;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  followingViewWidth?: number;
  sidebarDimension: number;
  [PANEL_TITLE_CONFIG_KEY]?: string;
};
