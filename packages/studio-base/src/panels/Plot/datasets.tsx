// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isTime, subtract, Time, toSec } from "@foxglove/rostime";
import { Immutable } from "@foxglove/studio";
import { Bounds, makeInvertedBounds } from "@foxglove/studio-base/types/Bounds";
import { format } from "@foxglove/studio-base/util/formatTime";
import { darkColor, getLineColor, lightColor } from "@foxglove/studio-base/util/plotColors";
import { formatTimeRaw, TimestampMethod } from "@foxglove/studio-base/util/time";

import {
  BasePlotPath,
  DataSet,
  Datum,
  isReferenceLinePlotPathType,
  PlotDataByPath,
  PlotDataItem,
  PlotPath,
  PlotXAxisVal,
} from "./internalTypes";
import { applyToDatum, MathFunction, mathFunctions } from "./transformPlotRange";

const isCustomScale = (xAxisVal: PlotXAxisVal): boolean =>
  xAxisVal === "custom" || xAxisVal === "currentCustom";

function getXForPoint(
  xAxisVal: PlotXAxisVal,
  timestamp: number,
  innerIdx: number,
  xAxisRanges: Immutable<PlotDataItem[]> | undefined,
  xItem: undefined | Immutable<PlotDataItem>,
  xAxisPath: BasePlotPath | undefined,
): number | bigint {
  if (isCustomScale(xAxisVal) && xAxisPath) {
    if (isReferenceLinePlotPathType(xAxisPath)) {
      return Number.parseFloat(xAxisPath.value);
    }
    if (xAxisRanges) {
      if (!xItem) {
        return NaN;
      }
      const value = xItem.queriedData[innerIdx]?.value;
      return isTime(value) ? toSec(value) : typeof value === "bigint" ? value : Number(value);
    }
  }
  return xAxisVal === "timestamp" ? timestamp : innerIdx;
}

function getDatumsForMessagePathItem(
  yItem: Immutable<PlotDataItem>,
  xItem: undefined | Immutable<PlotDataItem>,
  startTime: Time,
  timestampMethod: TimestampMethod,
  xAxisVal: PlotXAxisVal,
  xAxisPath?: BasePlotPath,
  xAxisRanges?: Immutable<PlotDataItem[]>,
): { data: Datum[]; hasMismatchedData: boolean } {
  const timestamp = timestampMethod === "headerStamp" ? yItem.headerStamp : yItem.receiveTime;
  if (!timestamp) {
    return { data: [], hasMismatchedData: false };
  }
  const data: Datum[] = [];
  const elapsedTime = toSec(subtract(timestamp, startTime));
  for (const entry of yItem.queriedData.entries()) {
    const [innerIdx, { value, constantName }] = entry;
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "string" ||
      typeof value === "bigint"
    ) {
      const valueNum = typeof value === "bigint" ? value : Number(value);
      if (typeof valueNum === "bigint" || !isNaN(valueNum)) {
        const x = getXForPoint(xAxisVal, elapsedTime, innerIdx, xAxisRanges, xItem, xAxisPath);
        const y = valueNum;

        data.push({
          x: Number(x),
          y: Number(y),
          value,
          constantName,
          receiveTime: yItem.receiveTime,
          headerStamp: yItem.headerStamp,
        });
      }
    } else if (isTime(value)) {
      const x = getXForPoint(xAxisVal, elapsedTime, innerIdx, xAxisRanges, xItem, xAxisPath);
      const y = toSec(value);

      data.push({
        x: Number(x),
        y,
        receiveTime: yItem.receiveTime,
        headerStamp: yItem.headerStamp,
        value: `${format(value)} (${formatTimeRaw(value)})`,
        constantName,
      });
    }
  }

  const hasMismatchedData =
    isCustomScale(xAxisVal) && (!xItem || yItem.queriedData.length !== xItem.queriedData.length);
  return { data, hasMismatchedData };
}

function getDatasetsFromMessagePlotPath({
  path,
  yAxisRanges,
  index,
  startTime,
  xAxisVal,
  xAxisRanges,
  xAxisPath,
  invertedTheme = false,
}: {
  path: PlotPath;
  yAxisRanges: Immutable<PlotDataItem[]>;
  index: number;
  startTime: Time;
  xAxisVal: PlotXAxisVal;
  xAxisRanges: Immutable<PlotDataItem[]> | undefined;
  xAxisPath?: BasePlotPath;
  invertedTheme?: boolean;
}): {
  dataset: DataSet;
  hasMismatchedData: boolean;
} {
  let showLine = path.showLine !== false;
  let hasMismatchedData =
    isCustomScale(xAxisVal) &&
    xAxisRanges != undefined &&
    yAxisRanges.length !== xAxisRanges.length;

  const plotData: Datum[] = [];

  let maybeMathFn: MathFunction | undefined;
  for (const funcName of Object.keys(mathFunctions)) {
    if (path.value.endsWith(`.@${funcName}`)) {
      maybeMathFn = mathFunctions[funcName];
      if (maybeMathFn) {
        break;
      }
    }
  }

  const rangeData: Datum[] = [];
  for (const [rangeIdx, item] of yAxisRanges.entries()) {
    const xItem = xAxisRanges?.[rangeIdx];
    const { data: datums, hasMismatchedData: itemHasMismatchedData } = getDatumsForMessagePathItem(
      item,
      xItem,
      startTime,
      path.timestampMethod,
      xAxisVal,
      xAxisPath,
      xAxisRanges,
    );

    for (const datum of datums) {
      if (maybeMathFn) {
        rangeData.push(applyToDatum(datum, maybeMathFn));
      } else {
        rangeData.push(datum);
      }
    }

    hasMismatchedData = hasMismatchedData || itemHasMismatchedData;
    // If we have added more than one point for this message, make it a scatter plot.
    if (item.queriedData.length > 1 && xAxisVal !== "index") {
      showLine = false;
    }
  }

  for (const datum of rangeData) {
    plotData.push(datum);
  }

  const borderColor = getLineColor(path.color, index);
  const dataset: DataSet = {
    borderColor,
    label: path.label != undefined && path.label !== "" ? path.label : path.value,
    showLine,
    fill: false,
    borderWidth: 1,
    pointRadius: 1,
    pointHoverRadius: 3,
    pointBackgroundColor: invertedTheme ? lightColor(borderColor) : darkColor(borderColor),
    pointBorderColor: "transparent",
    data: plotData,
  };
  return {
    dataset,
    hasMismatchedData,
  };
}

type GetDatasetArgs = Immutable<{
  paths: PlotPath[];
  itemsByPath: PlotDataByPath;
  startTime: Time;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  invertedTheme?: boolean;
}>;

type DatasetWithPath = { path: PlotPath; dataset: DataSet };

export type DataSets = {
  bounds: Bounds;
  datasets: Array<undefined | DatasetWithPath>;
  pathsWithMismatchedDataLengths: string[];
};

export function getDatasets({
  paths,
  itemsByPath,
  startTime,
  xAxisVal,
  xAxisPath,
  invertedTheme,
}: GetDatasetArgs): DataSets {
  const bounds: Bounds = makeInvertedBounds();
  const pathsWithMismatchedDataLengths: string[] = [];
  const datasets: DataSets["datasets"] = [];
  for (const [index, path] of paths.entries()) {
    const yRanges = itemsByPath[path.value] ?? [];
    const xRanges = xAxisPath && itemsByPath[xAxisPath.value];
    if (!path.enabled) {
      datasets.push(undefined);
    } else if (!isReferenceLinePlotPathType(path)) {
      const res = getDatasetsFromMessagePlotPath({
        path,
        yAxisRanges: yRanges,
        index,
        startTime,
        xAxisVal,
        xAxisRanges: xRanges,
        xAxisPath,
        invertedTheme,
      });

      if (res.hasMismatchedData) {
        pathsWithMismatchedDataLengths.push(path.value);
      }
      for (const datum of res.dataset.data) {
        if (isFinite(datum.x)) {
          bounds.x.min = Math.min(bounds.x.min, datum.x);
          bounds.x.max = Math.max(bounds.x.max, datum.x);
        }
        if (isFinite(datum.y)) {
          bounds.y.min = Math.min(bounds.y.min, datum.y);
          bounds.y.max = Math.max(bounds.y.max, datum.y);
        }
      }
      datasets.push({ path, dataset: res.dataset });
    }
  }

  return {
    bounds,
    datasets,
    pathsWithMismatchedDataLengths,
  };
}

/**
 * Merges two datasets into a single dataset containing all points from both.
 */
export function mergeDatasets(
  a: undefined | DatasetWithPath,
  b: undefined | DatasetWithPath,
): undefined | DatasetWithPath {
  if (a == undefined) {
    return b;
  }
  if (b == undefined) {
    return a;
  }
  return {
    path: a.path,
    dataset: {
      ...a.dataset,
      data: a.dataset.data.concat(b.dataset.data),
      showLine: a.dataset.showLine === true && b.dataset.showLine === true,
    },
  };
}
