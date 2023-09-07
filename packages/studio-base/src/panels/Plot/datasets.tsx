// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { isTime, subtract, Time, toSec } from "@foxglove/rostime";
import { Immutable } from "@foxglove/studio";
import {
  iterateTyped,
  findIndices,
  getTypedLength,
} from "@foxglove/studio-base/components/Chart/datasets";
import { format } from "@foxglove/studio-base/util/formatTime";
import { darkColor, getLineColor, lightColor } from "@foxglove/studio-base/util/plotColors";
import { formatTimeRaw, TimestampMethod } from "@foxglove/studio-base/util/time";

import {
  BasePlotPath,
  Datum,
  TypedDataSet,
  TypedData,
  isReferenceLinePlotPathType,
  PlotDataItem,
  PlotPath,
  PlotXAxisVal,
} from "./internalTypes";
import { applyToDatum, MathFunction, mathFunctions } from "./transformPlotRange";

const ZERO_TIME: Time = Object.freeze({ sec: 0, nsec: 0 });

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

export function datumToTyped(data: Datum[]): TypedData {
  const receiveTime: Time[] = [];
  const headerStamp: Time[] = [];
  const constantName: string[] = [];
  const value: (string | number | bigint | boolean | undefined)[] = [];
  const x = new Float32Array(data.length);
  const y = new Float32Array(data.length);

  for (let i = 0; i < data.length; i++) {
    const datum = data[i];
    if (datum == undefined) {
      continue;
    }
    receiveTime.push(datum.receiveTime);
    if (datum.headerStamp != undefined) {
      headerStamp.push(datum.headerStamp);
    }
    if (datum.constantName != undefined) {
      constantName.push(datum.constantName);
    }
    value.push(datum.value);
    x[i] = datum.x;
    y[i] = datum.y;
  }

  return {
    receiveTime,
    ...(constantName.length > 0 ? { constantName } : {}),
    ...(headerStamp.length > 0 ? { headerStamp } : {}),
    value,
    x,
    y,
  };
}

export function concatTyped(a: TypedData[], b: TypedData[]): TypedData[] {
  return a.concat(...b);
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
  dataset: TypedDataSet;
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
  const dataset: TypedDataSet = {
    borderColor,
    label: path.label != undefined && path.label !== "" ? path.label : path.value,
    showLine,
    fill: false,
    borderWidth: 1,
    pointRadius: 1,
    pointHoverRadius: 3,
    pointBackgroundColor: invertedTheme ? lightColor(borderColor) : darkColor(borderColor),
    pointBorderColor: "transparent",
    data: [datumToTyped(plotData)],
  };
  return {
    dataset,
    hasMismatchedData,
  };
}

export function resolveTypedIndices(data: TypedData[], indices: number[]): TypedData[] | undefined {
  if (data.length === 0 || indices.length === 0) {
    return undefined;
  }

  const receiveTime: Time[] = [];
  const headerStamp: Time[] = [];
  const constantName: string[] = [];
  const value: (string | number | bigint | boolean | undefined)[] = [];
  const x = new Float32Array(indices.length);
  const y = new Float32Array(indices.length);

  for (let i = 0; i < indices.length; i++) {
    const loc = findIndices(data, indices[i] ?? -1);
    if (loc == undefined) {
      return undefined;
    }

    const [sliceIndex, offset] = loc;
    const slice = data[sliceIndex];
    if (slice == undefined) {
      return undefined;
    }

    receiveTime.push(slice.receiveTime[offset] ?? ZERO_TIME);
    if (slice.headerStamp != undefined) {
      headerStamp.push(slice.headerStamp[offset] ?? ZERO_TIME);
    }
    if (slice.constantName != undefined) {
      constantName.push(slice.constantName[offset] ?? "");
    }
    value.push(slice.value[offset]);

    const xVal = slice.x[offset];
    const yVal = slice.y[offset];
    if (xVal == undefined || yVal == undefined) {
      return undefined;
    }
    x[i] = xVal;
    y[i] = yVal;
  }

  return [
    {
      receiveTime,
      ...(constantName.length > 0 ? { constantName } : {}),
      ...(headerStamp.length > 0 ? { headerStamp } : {}),
      value,
      x,
      y,
    },
  ];
}

function getSliceIndices(
  length: number,
  start: number,
  end: number | undefined,
): [start: number, end: number] {
  let clampedStart = R.clamp(0, length, start < 0 ? length + start : start);
  let clampedEnd = end ?? length;
  clampedEnd = R.clamp(0, length, clampedEnd < 0 ? length + clampedEnd : clampedEnd);
  if (clampedStart > clampedEnd) {
    const i = clampedStart;
    clampedStart = clampedEnd;
    clampedEnd = i;
  }

  return [clampedStart, clampedEnd];
}

function sliceSingle(slice: TypedData, start: number, end?: number): TypedData {
  const [i0, i1] = getSliceIndices(slice.x.length, start, end);

  const numElements = i1 - i0;

  const receiveTime: Time[] = [];
  const headerStamp: Time[] = [];
  const constantName: string[] = [];
  const value: (string | number | bigint | boolean | undefined)[] = [];
  const x = new Float32Array(numElements);
  const y = new Float32Array(numElements);

  for (let i = i0; i < i1; i++) {
    receiveTime.push(slice.receiveTime[i] ?? ZERO_TIME);
    if (slice.headerStamp != undefined) {
      headerStamp.push(slice.headerStamp[i] ?? ZERO_TIME);
    }
    if (slice.constantName != undefined) {
      constantName.push(slice.constantName[i] ?? "");
    }
    value.push(slice.value[i]);

    const xVal = slice.x[i];
    const yVal = slice.y[i];
    if (xVal == undefined || yVal == undefined) {
      continue;
    }
    x[i - i0] = xVal;
    y[i - i0] = yVal;
  }

  return {
    receiveTime,
    headerStamp: headerStamp.length > 0 ? headerStamp : undefined,
    constantName: constantName.length > 0 ? constantName : undefined,
    value,
    x,
    y,
  };
}

export function sliceTyped(dataset: TypedData[], start: number, end?: number): TypedData[] {
  const numElements = getTypedLength(dataset);
  const [i0, i1] = getSliceIndices(numElements, start, end);
  if (i0 === i1) {
    return [];
  }

  const startLoc = findIndices(dataset, i0);
  const endLoc = findIndices(dataset, i1);
  if (startLoc == undefined || endLoc == undefined) {
    return [];
  }

  const [slice0, offset0] = startLoc;
  const [slice1, offset1] = endLoc;
  if (slice0 === slice1) {
    const slice = dataset[slice0];
    if (slice == undefined) {
      return [];
    }

    return [sliceSingle(slice, offset0, offset1)];
  }

  const startSlice = dataset[slice0];
  const endSlice = dataset[slice1];

  if (startSlice == undefined || endSlice == undefined) {
    return [];
  }

  const between = dataset.slice(slice0 + 1, slice1);

  return [sliceSingle(startSlice, offset0), ...between, sliceSingle(endSlice, 0, offset1)];
}

export function getXBounds(dataset: TypedData[]): [min: number, max: number] | undefined {
  const min = dataset.at(0)?.x.at(0);
  const max = dataset.at(-1)?.x.at(-1);
  if (min == undefined || max == undefined) {
    return undefined;
  }

  return [min, max];
}

export function mergeTyped(a: TypedData[], b: TypedData[]): TypedData[] {
  const lastTime = getXBounds(a)?.[1] ?? Number.MIN_SAFE_INTEGER;

  let startIndex = -1;
  for (const datum of iterateTyped(b)) {
    if (datum.x > lastTime) {
      startIndex = datum.index;
      break;
    }
  }

  if (startIndex === -1) {
    return a;
  }

  const newValues = sliceTyped(b, startIndex);
  if (newValues.length === 0) {
    return a;
  }

  return a.concat(datumToTyped([{ x: NaN, receiveTime: ZERO_TIME, y: NaN } as Datum]), newValues);
}

export function derivative(data: TypedData[]): TypedData[] {
  const newDatums: Datum[] = [];

  let prevX: number = 0;
  let prevY: number = 0;
  for (const datum of iterateTyped(data)) {
    if (datum.index === 0) {
      prevX = datum.x;
      prevY = datum.y;
      continue;
    }

    const secondsDifference = datum.x - prevX;
    const value = (datum.y - prevY) / secondsDifference;
    newDatums.push({
      ...datum,
      y: value,
      value,
    });
    prevX = datum.x;
    prevY = datum.y;
  }

  return [datumToTyped(newDatums)];
}
