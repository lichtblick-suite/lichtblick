// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { v4 as uuidv4 } from "uuid";

import { filterMap } from "@foxglove/den/collection";
import { isTime, Time, toSec, subtract } from "@foxglove/rostime";
import { format } from "@foxglove/studio-base/util/formatTime";
import { darkColor, lightColor, lineColors } from "@foxglove/studio-base/util/plotColors";
import { formatTimeRaw, TimestampMethod } from "@foxglove/studio-base/util/time";

import { PlotXAxisVal } from "./index";
import {
  BasePlotPath,
  DataSet,
  isReferenceLinePlotPathType,
  PlotDataByPath,
  PlotDataItem,
  PlotPath,
  Datum,
} from "./internalTypes";
import { derivative, applyToDatum, mathFunctions, MathFunction } from "./transformPlotRange";

const isCustomScale = (xAxisVal: PlotXAxisVal): boolean =>
  xAxisVal === "custom" || xAxisVal === "currentCustom";

function getXForPoint(
  xAxisVal: PlotXAxisVal,
  timestamp: number,
  innerIdx: number,
  xAxisRanges: readonly (readonly PlotDataItem[])[] | undefined,
  xItem: PlotDataItem | undefined,
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
  yItem: PlotDataItem,
  xItem: PlotDataItem | undefined,
  startTime: Time,
  timestampMethod: TimestampMethod,
  xAxisVal: PlotXAxisVal,
  xAxisPath?: BasePlotPath,
  xAxisRanges?: readonly (readonly PlotDataItem[])[],
): { data: Datum[]; hasMismatchedData: boolean } {
  const timestamp = timestampMethod === "headerStamp" ? yItem.headerStamp : yItem.receiveTime;
  if (!timestamp) {
    return { data: [], hasMismatchedData: false };
  }
  const data: Datum[] = [];
  const elapsedTime = toSec(subtract(timestamp, startTime));
  for (const entry of yItem.queriedData.entries()) {
    const [innerIdx, { value, path: queriedPath, constantName }] = entry;
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
          path: queriedPath,
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
        path: queriedPath,
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
  yAxisRanges: readonly (readonly PlotDataItem[])[];
  index: number;
  startTime: Time;
  xAxisVal: PlotXAxisVal;
  xAxisRanges: readonly (readonly PlotDataItem[])[] | undefined;
  xAxisPath?: BasePlotPath;
  invertedTheme?: boolean;
}): {
  dataset: DataSet;
  hasMismatchedData: boolean;
} {
  let showLine = true;
  let hasMismatchedData =
    isCustomScale(xAxisVal) &&
    xAxisRanges != undefined &&
    (yAxisRanges.length !== xAxisRanges.length ||
      xAxisRanges.every((range, rangeIndex) => range.length !== yAxisRanges[rangeIndex]?.length));

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

  for (const [rangeIdx, range] of yAxisRanges.entries()) {
    const xRange: readonly PlotDataItem[] | undefined = xAxisRanges?.[rangeIdx];
    let rangeData: Datum[] = [];
    for (const [outerIdx, item] of range.entries()) {
      const xItem: PlotDataItem | undefined = xRange?.[outerIdx];
      const { data: datums, hasMismatchedData: itemHasMistmatchedData } =
        getDatumsForMessagePathItem(
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

      hasMismatchedData = hasMismatchedData || itemHasMistmatchedData;
      // If we have added more than one point for this message, make it a scatter plot.
      if (item.queriedData.length > 1 && xAxisVal !== "index") {
        showLine = false;
      }
    }

    if (path.value.endsWith(".@derivative")) {
      if (showLine) {
        rangeData = derivative(rangeData);
      } else {
        // If we have a scatter plot, we can't take the derivative, so instead show nothing
        rangeData = [];
      }
    }

    // NaN points are not displayed, and result in a break in the line.
    // We add NaN points before each range (avoid adding before the very first range)
    if (rangeIdx > 0) {
      plotData.push({
        x: NaN,
        y: NaN,
        receiveTime: { sec: 0, nsec: 0 },
        value: "",
        path: path.value,
      });
    }
    for (const datum of rangeData) {
      plotData.push(datum);
    }
  }

  const borderColor = lineColors[index % lineColors.length] ?? "#DDDDDD";
  const dataset: DataSet = {
    borderColor,
    label: path.value ? path.value : uuidv4(),
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

type Args = {
  paths: PlotPath[];
  itemsByPath: PlotDataByPath;
  startTime: Time;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  invertedTheme?: boolean;
};

type ReturnVal = {
  datasets: DataSet[];
  pathsWithMismatchedDataLengths: string[];
};

export function getDatasets({
  paths,
  itemsByPath,
  startTime,
  xAxisVal,
  xAxisPath,
  invertedTheme,
}: Args): ReturnVal {
  const pathsWithMismatchedDataLengths: string[] = [];
  const datasets = filterMap(paths, (path: PlotPath, index: number) => {
    const yRanges = itemsByPath[path.value] ?? [];
    const xRanges = xAxisPath && itemsByPath[xAxisPath.value];
    if (!path.enabled) {
      return undefined;
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
      return res.dataset;
    }
    return undefined;
  });

  return {
    datasets,
    pathsWithMismatchedDataLengths,
  };
}
