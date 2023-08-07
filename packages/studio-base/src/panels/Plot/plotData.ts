// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEmpty } from "lodash";
import memoizeWeak from "memoize-weak";

import { Time } from "@foxglove/rostime";
import { Immutable as Im } from "@foxglove/studio";
import { MessageAndData } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { getDatasetsFromMessagePlotPath } from "@foxglove/studio-base/panels/Plot/datasets";
import { Bounds, makeInvertedBounds, unionBounds } from "@foxglove/studio-base/types/Bounds";
import { Range } from "@foxglove/studio-base/util/ranges";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

import {
  DatasetsByPath,
  Datum,
  PlotDataItem,
  PlotPath,
  PlotXAxisVal,
  isReferenceLinePlotPathType,
} from "./internalTypes";
import * as maps from "./maps";

/**
 * Plot data bundles datasets with precomputed bounds and paths with mismatched data
 * paths. It's used to contain data from blocks and currentFrame segments and eventually
 * is merged into a single object and passed to the chart components.
 */
export type PlotData = {
  bounds: Bounds;
  datasetsByPath: DatasetsByPath;
  pathsWithMismatchedDataLengths: string[];
};

export const EmptyPlotData: Im<PlotData> = Object.freeze({
  bounds: makeInvertedBounds(),
  datasetsByPath: new Map(),
  pathsWithMismatchedDataLengths: [],
});

/**
 * Find the earliest and latest times of messages in data, for all messages and per-path.
 * Assumes invidual ranges of messages are already sorted by receiveTime.
 */
function findXRanges(data: Im<PlotData>): {
  all: Range;
  byPath: Record<string, Range>;
} {
  const byPath: Record<string, Range> = {};
  let start = Number.MAX_SAFE_INTEGER;
  let end = Number.MIN_SAFE_INTEGER;
  for (const [path, dataset] of data.datasetsByPath) {
    const thisPath = (byPath[path.value] = {
      start: Number.MAX_SAFE_INTEGER,
      end: Number.MIN_SAFE_INTEGER,
    });
    thisPath.start = Math.min(thisPath.start, dataset.data.at(0)?.x ?? Number.MAX_SAFE_INTEGER);
    thisPath.end = Math.max(thisPath.end, dataset.data.at(-1)?.x ?? Number.MIN_SAFE_INTEGER);
    start = Math.min(start, thisPath.start);
    end = Math.max(end, thisPath.end);
  }

  return { all: { start, end }, byPath };
}

/**
 * Appends new PlotData to existing PlotData. Assumes there are no time overlaps between
 * the two items.
 */
export function appendPlotData(a: Im<PlotData>, b: Im<PlotData>): Im<PlotData> {
  if (a === EmptyPlotData) {
    return b;
  }

  if (b === EmptyPlotData) {
    return a;
  }

  return {
    ...a,
    bounds: unionBounds(a.bounds, b.bounds),
    datasetsByPath: maps.merge(a.datasetsByPath, b.datasetsByPath, (aVal, bVal) => {
      return {
        ...aVal,
        data: aVal.data.concat(bVal.data),
      };
    }),
  };
}

/**
 * Merge two PlotData objects into a single PlotData object, discarding any overlapping
 * messages between the two items. Assumes they represent non-contiguous segments of a
 * chart.
 */
function mergePlotData(a: Im<PlotData>, b: Im<PlotData>): Im<PlotData> {
  if (a === EmptyPlotData) {
    return b;
  }

  if (b === EmptyPlotData) {
    return a;
  }

  return {
    ...a,
    bounds: unionBounds(a.bounds, b.bounds),
    datasetsByPath: maps.merge(a.datasetsByPath, b.datasetsByPath, (aVal, bVal) => {
      const lastTime = aVal.data.at(-1)?.x ?? Number.MIN_SAFE_INTEGER;
      const newValues = bVal.data.filter((datum) => datum.x > lastTime);
      if (newValues.length > 0) {
        return {
          ...aVal,
          // Insert NaN/NaN datum to cause a break in the line.
          data: aVal.data.concat({ x: NaN, y: NaN } as Datum, newValues),
        };
      } else {
        return aVal;
      }
    }),
  };
}

const memoFindXRanges = memoizeWeak(findXRanges);

// Sort by start time, then end time, so that folding from the left gives us the
// right consolidated interval.
function compare(a: Im<PlotData>, b: Im<PlotData>): number {
  const rangeA = memoFindXRanges(a).all;
  const rangeB = memoFindXRanges(b).all;
  const startCompare = rangeA.start - rangeB.start;
  return startCompare !== 0 ? startCompare : rangeA.end - rangeB.end;
}

/**
 * Convert MessageAndData into a PlotDataItem.
 *
 * Note: this is a free function so we are not making it for every loop iteration
 * in `getByPath` below.
 */
export function messageAndDataToPathItem(messageAndData: MessageAndData): PlotDataItem {
  const headerStamp = getTimestampForMessage(messageAndData.messageEvent.message);
  return {
    queriedData: messageAndData.queriedData,
    receiveTime: messageAndData.messageEvent.receiveTime,
    headerStamp,
  };
}

/**
 * Reduce multiple PlotData objects into a single PlotData object, concatenating messages
 * for each path after trimming messages that overlap between items.
 */
export function reducePlotData(data: Im<PlotData[]>): Im<PlotData> {
  const sorted = data.slice().sort(compare);

  const reduced = sorted.reduce((acc, item) => {
    if (isEmpty(acc)) {
      return item;
    }
    return mergePlotData(acc, item);
  }, EmptyPlotData);

  return reduced;
}

export function buildPlotData(
  args: Im<{
    invertedTheme?: boolean;
    itemsByPath: Map<PlotPath, PlotDataItem[]>;
    paths: PlotPath[];
    startTime: Time;
    xAxisPath?: PlotPath;
    xAxisVal: PlotXAxisVal;
  }>,
): PlotData {
  const { paths, itemsByPath, startTime, xAxisVal, xAxisPath, invertedTheme } = args;
  const bounds: Bounds = makeInvertedBounds();
  const pathsWithMismatchedDataLengths: string[] = [];
  const datasets: DatasetsByPath = new Map();
  for (const [index, path] of paths.entries()) {
    const yRanges = itemsByPath.get(path) ?? [];
    const xRanges = xAxisPath && itemsByPath.get(xAxisPath);
    if (!path.enabled) {
      continue;
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
      datasets.set(path, res.dataset);
    }
  }

  return {
    bounds,
    datasetsByPath: datasets,
    pathsWithMismatchedDataLengths,
  };
}
