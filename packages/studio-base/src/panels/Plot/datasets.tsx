// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import flatten from "lodash/flatten";
import { v4 as uuidv4 } from "uuid";

import { filterMap } from "@foxglove/den/collection";
import { isTime, Time, toSec, subtract } from "@foxglove/rostime";
import {
  TimeBasedChartTooltipData,
  TooltipItem,
} from "@foxglove/studio-base/components/TimeBasedChart";
import { format } from "@foxglove/studio-base/util/formatTime";
import { lightColor, lineColors } from "@foxglove/studio-base/util/plotColors";
import { formatTimeRaw, TimestampMethod } from "@foxglove/studio-base/util/time";

import { PlotXAxisVal } from "./index";
import {
  BasePlotPath,
  DataSet,
  isReferenceLinePlotPathType,
  PlotChartPoint,
  PlotDataByPath,
  PlotPath,
} from "./internalTypes";
import { derivative, applyToDataOrTooltips, mathFunctions } from "./transformPlotRange";

type PointsAndTooltips = {
  points: PlotChartPoint[];
  tooltips: TimeBasedChartTooltipData[];
  hasMismatchedData: boolean;
};

const isCustomScale = (xAxisVal: PlotXAxisVal): boolean =>
  xAxisVal === "custom" || xAxisVal === "currentCustom";

function getXForPoint(
  xAxisVal: PlotXAxisVal,
  timestamp: number,
  innerIdx: number,
  xAxisRanges: readonly (readonly TooltipItem[])[] | undefined,
  xItem: TooltipItem | undefined,
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

function getPointsAndTooltipsForMessagePathItem(
  yItem: TooltipItem,
  xItem: TooltipItem | undefined,
  startTime: Time,
  timestampMethod: TimestampMethod,
  xAxisVal: PlotXAxisVal,
  xAxisPath?: BasePlotPath,
  xAxisRanges?: readonly (readonly TooltipItem[])[],
  datasetKey?: string,
): PointsAndTooltips {
  const points: PlotChartPoint[] = [];
  const tooltips: TimeBasedChartTooltipData[] = [];
  const timestamp = timestampMethod === "headerStamp" ? yItem.headerStamp : yItem.receiveTime;
  if (!timestamp) {
    return { points, tooltips, hasMismatchedData: false };
  }
  const elapsedTime = toSec(subtract(timestamp, startTime));
  for (const [
    innerIdx,
    { value, path: queriedPath, constantName },
  ] of yItem.queriedData.entries()) {
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
        const tooltip = {
          x,
          y,
          datasetKey,
          item: yItem,
          path: queriedPath,
          value,
          constantName,
          startTime,
        };
        points.push({ x: Number(x), y: Number(y) });
        tooltips.push(tooltip);
      }
    } else if (isTime(value)) {
      const x = getXForPoint(xAxisVal, elapsedTime, innerIdx, xAxisRanges, xItem, xAxisPath);
      const y = toSec(value);
      const tooltip = {
        x,
        y,
        datasetKey,
        item: yItem,
        path: queriedPath,
        value: `${format(value)} (${formatTimeRaw(value)})`,
        constantName,
        startTime,
      };
      points.push({ x: Number(x), y });
      tooltips.push(tooltip);
    }
  }
  const hasMismatchedData =
    isCustomScale(xAxisVal) && (!xItem || yItem.queriedData.length !== xItem.queriedData.length);
  return { points, tooltips, hasMismatchedData };
}

function getDatasetAndTooltipsFromMessagePlotPath(
  path: PlotPath,
  yAxisRanges: readonly (readonly TooltipItem[])[],
  index: number,
  startTime: Time,
  xAxisVal: PlotXAxisVal,
  xAxisRanges: readonly (readonly TooltipItem[])[] | undefined,
  xAxisPath?: BasePlotPath,
): {
  dataset: DataSet;
  tooltips: TimeBasedChartTooltipData[];
  hasMismatchedData: boolean;
  path: string;
} {
  let showLine = true;
  const datasetKey = index.toString();

  let hasMismatchedData =
    isCustomScale(xAxisVal) &&
    xAxisRanges != undefined &&
    (yAxisRanges.length !== xAxisRanges.length ||
      xAxisRanges.every((range, rangeIndex) => range.length !== yAxisRanges[rangeIndex]?.length));
  let rangesOfTooltips: TimeBasedChartTooltipData[][] = [];
  let rangesOfPoints: PlotChartPoint[][] = [];
  for (const [rangeIdx, range] of yAxisRanges.entries()) {
    const xRange: readonly TooltipItem[] | undefined = xAxisRanges?.[rangeIdx];
    const rangeTooltips = [];
    const rangePoints = [];
    for (const [outerIdx, item] of range.entries()) {
      const xItem: TooltipItem | undefined = xRange?.[outerIdx];
      const {
        points: itemPoints,
        tooltips: itemTooltips,
        hasMismatchedData: itemHasMistmatchedData,
      } = getPointsAndTooltipsForMessagePathItem(
        item,
        xItem,
        startTime,
        path.timestampMethod,
        xAxisVal,
        xAxisPath,
        xAxisRanges,
        datasetKey,
      );
      for (const point of itemPoints) {
        rangePoints.push(point);
      }
      for (const tooltip of itemTooltips) {
        rangeTooltips.push(tooltip);
      }
      hasMismatchedData = hasMismatchedData || itemHasMistmatchedData;
      // If we have added more than one point for this message, make it a scatter plot.
      if (item.queriedData.length > 1 && xAxisVal !== "index") {
        showLine = false;
      }
    }
    rangesOfTooltips.push(rangeTooltips);
    rangesOfPoints.push(rangePoints);
  }

  if (path.value.endsWith(".@derivative")) {
    if (showLine) {
      const newRangesOfTooltips = [];
      const newRangesOfPoints = [];
      for (const [rangeIdx, rangePoints] of rangesOfPoints.entries()) {
        const rangeTooltips = rangesOfTooltips[rangeIdx] ?? [];
        const { points, tooltips } = derivative(rangePoints, rangeTooltips);
        newRangesOfTooltips.push(tooltips);
        newRangesOfPoints.push(points);
      }
      rangesOfPoints = newRangesOfPoints;
      rangesOfTooltips = newRangesOfTooltips;
    } else {
      // If we have a scatter plot, we can't take the derivative, so instead show nothing
      // (nothing is better than incorrect data).
      rangesOfPoints = [];
      rangesOfTooltips = [];
    }
  }
  for (const funcName of Object.keys(mathFunctions)) {
    if (path.value.endsWith(`.@${funcName}`)) {
      const mathFn = mathFunctions[funcName];
      if (!mathFn) {
        break;
      }

      rangesOfPoints = rangesOfPoints.map((points) => applyToDataOrTooltips(points, mathFn));
      rangesOfTooltips = rangesOfTooltips.map((tooltips) =>
        applyToDataOrTooltips(tooltips, mathFn),
      );
      break;
    }
  }

  // Put gaps between ranges.
  rangesOfPoints.forEach((rangePoints, i) => {
    if (i !== rangesOfPoints.length - 1) {
      // NaN points are not displayed, and result in a break in the line. A note: After this point
      // there may be fewer tooltips than points, which we rely on above. We should do this last.
      rangePoints.push({ x: NaN, y: NaN });
    }
  });

  const borderColor = lineColors[index % lineColors.length] ?? "#DDDDDD";
  const dataset: DataSet = {
    borderColor,
    label: path.value ? path.value : uuidv4(),
    showLine,
    fill: false,
    borderWidth: 1,
    pointRadius: 1,
    pointHoverRadius: 3,
    pointBackgroundColor: lightColor(borderColor),
    pointBorderColor: "transparent",
    data: flatten(rangesOfPoints),
  };
  return {
    dataset,
    tooltips: flatten(rangesOfTooltips),
    hasMismatchedData,
    path: path.value,
  };
}

export function getDatasetsAndTooltips(
  paths: PlotPath[],
  itemsByPath: PlotDataByPath,
  startTime: Time,
  xAxisVal: PlotXAxisVal,
  xAxisPath?: BasePlotPath,
): {
  datasets: DataSet[];
  tooltips: TimeBasedChartTooltipData[];
  pathsWithMismatchedDataLengths: string[];
} {
  const datasetsAndTooltips = filterMap(paths, (path: PlotPath, index: number) => {
    const yRanges = itemsByPath[path.value] ?? [];
    const xRanges = xAxisPath && itemsByPath[xAxisPath.value];
    if (!path.enabled) {
      return undefined;
    } else if (!isReferenceLinePlotPathType(path)) {
      return getDatasetAndTooltipsFromMessagePlotPath(
        path,
        yRanges,
        index,
        startTime,
        xAxisVal,
        xRanges,
        xAxisPath,
      );
    }
    return undefined;
  });

  return {
    datasets: datasetsAndTooltips.map(({ dataset }) => dataset),
    tooltips: flatten(datasetsAndTooltips.map(({ tooltips }) => tooltips)),
    pathsWithMismatchedDataLengths: datasetsAndTooltips
      .filter(({ hasMismatchedData }) => hasMismatchedData)
      .map(({ path }) => path),
  };
}
