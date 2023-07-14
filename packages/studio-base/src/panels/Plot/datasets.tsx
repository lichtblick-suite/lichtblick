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

/**
 * Calculates the bounds of a dataset by iterating through all data.
 */
export function calculateDatasetBounds(dataset: Immutable<DataSet>): undefined | Bounds {
  if (dataset.data.length === 0) {
    return undefined;
  }

  const newBounds = makeInvertedBounds();
  for (const datum of dataset.data) {
    newBounds.x.min = Math.min(newBounds.x.min, datum.x);
    newBounds.x.max = Math.max(newBounds.x.max, datum.x);
    newBounds.y.min = Math.min(newBounds.y.min, datum.y);
    newBounds.y.max = Math.max(newBounds.y.max, datum.y);
  }

  return newBounds;
}

export function getDatasetsFromMessagePlotPath({
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
