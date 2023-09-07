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

import { ChartDataset } from "chart.js";

import { Time } from "@foxglove/rostime";
import { Immutable } from "@foxglove/studio";
import type { TypedData as OriginalTypedData } from "@foxglove/studio-base/components/Chart/types";
import { MessagePathStructureItemMessage } from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import { MessagePathDataItem } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import type { ChartDatum } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { Topic, MessageEvent } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

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
};
export type PlotDataByPath = Map<PlotPath, PlotDataItem[]>;

// X-axis values:
export type PlotXAxisVal =
  | "timestamp" // Message playback time. Preloaded.
  | "index" // Message-path value index. One "current" message at playback time.
  | "custom" // Message path data. Preloaded.
  | "currentCustom"; // Message path data. One "current" message at playback time.

// In addition to the base datum, we also add receiveTime and optionally header stamp to our datums
// These are used in the csv export.
export type Datum = ChartDatum & {
  receiveTime: Time;
  headerStamp?: Time;
};

export type DataSet = ChartDataset<"scatter", Datum[]>;

export type TypedData = OriginalTypedData & {
  receiveTime: Time[];
  headerStamp?: Time[];
};
export type TypedDataSet = ChartDataset<"scatter", TypedData[]>;

// Key datasets by the full PlotPath instead of just the string value because we need to
// generate a new dataset if the plot path is ordered by headerStamp.
export type DatasetsByPath = Map<PlotPath, TypedDataSet>;

export type PlotDataItem = {
  queriedData: MessagePathDataItem[];
  receiveTime: Time;
  headerStamp?: Time;
};

// A "reference line" plot path is a numeric value. It creates a horizontal line on the plot at the specified value.
export function isReferenceLinePlotPathType(path: BasePlotPath): boolean {
  return !isNaN(Number.parseFloat(path.value));
}

export type Metadata = Immutable<{
  topics: Topic[];
  datatypes: RosDatatypes;
}>;

export type MetadataEnums = Metadata & {
  enumValues: { [datatype: string]: { [field: string]: { [value: string]: string } } };
  structures: Record<string, MessagePathStructureItemMessage>;
};

export type PlotParams = {
  startTime: Time;
  paths: readonly PlotPath[];
  invertedTheme?: boolean;
  xAxisPath?: BasePlotPath;
  xAxisVal: PlotXAxisVal;
  followingViewWidth: number | undefined;
  minXValue: number | undefined;
  maxXValue: number | undefined;
  minYValue: string | number | undefined;
  maxYValue: string | number | undefined;
};
