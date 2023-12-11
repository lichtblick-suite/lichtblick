// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import {
  iterateTyped,
  fastFindIndices,
  getTypedLength,
} from "@foxglove/studio-base/components/Chart/datasets";
import {
  downsampleScatter,
  downsampleTimeseries,
  DownsampleState,
  initDownsample as initTimeseries,
  continueDownsample,
  MAX_POINTS as DESIRED_POINTS,
} from "@foxglove/studio-base/components/TimeBasedChart/downsample";
import { PlotViewport, Bounds1D } from "@foxglove/studio-base/components/TimeBasedChart/types";

import {
  derivative,
  concatTyped,
  mergeTyped,
  getXBounds,
  sliceTyped,
  resolveTypedIndices,
} from "../datasets";
import { PlotPath, DatasetsByPath, TypedDataSet, TypedData } from "../internalTypes";
import { EmptyPlotData, PlotData, sortDataByHeaderStamp } from "../plotData";

type PathMap<T> = Map<PlotPath, T>;

// SourceState represents the downsample state of a signal from a signal
// source--current or blocks.
export type SourceState = {
  // The number of data points we have downsampled
  cursor: number;
  // The downsampled dataset for this source
  dataset: TypedDataSet | undefined;
  downsampleState: DownsampleState | undefined;
};

// PathState represents the downsample state for a single signal, including the
// merged state of both sources.
type PathState = {
  blocks: SourceState;
  current: SourceState;
  dataset: TypedDataSet | undefined;
  // Whether the viewport contains only a portion of the dataset, which is
  // downsampled independently
  isPartial: boolean;
};

export const initSource = (): SourceState => ({
  cursor: 0,
  downsampleState: undefined,
  dataset: undefined,
});

export const initPath = (): PathState => ({
  blocks: initSource(),
  current: initSource(),
  dataset: undefined,
  isPartial: false,
});

// Describes the complete state of a downsampled plot, including the states of
// all of that plot's downsampled signals.
export type Downsampled = {
  // Indicates that this dataset can be sent to the rendering thread
  isValid: boolean;
  // the viewport when we started accumulating downsampled data
  view: PlotViewport | undefined;
  paths: PathMap<PathState>;
  data: PlotData;
};

export const initDownsampled = (): Downsampled => {
  return {
    isValid: false,
    view: undefined,
    paths: new Map(),
    data: EmptyPlotData,
  };
};

// This factor is used for two related things:
// * When the viewport's x-axis shrinks or grows by this amount (as a
//   proportion of the previous viewport) since the last downsample, we
//   redownsample.
// * When the viewport's x-axis moves by this amount in either direction, we
//   redownsample.
const ZOOM_RESET_FACTOR = 0.2;

const downsampleDataset = (
  data: TypedData[],
  view: PlotViewport,
  numPoints?: number,
): TypedData[] | undefined => {
  const indices = downsampleTimeseries(iterateTyped(data), view, numPoints);
  const resolved = resolveTypedIndices(data, indices);
  if (resolved == undefined) {
    return undefined;
  }

  return resolved;
};

/**
 * Produce the union of all of the provided bounds.
 */
const combineBounds = (bounds: Bounds1D[]): Bounds1D | undefined => {
  if (bounds.length === 0) {
    return undefined;
  }

  let min = +Infinity;
  let max = -Infinity;
  for (const bound of bounds) {
    const { min: dataMin, max: dataMax } = bound;
    min = Math.min(dataMin, min);
    max = Math.max(dataMax, max);
  }

  return { min, max };
};

const getPlotBounds = (data: PlotData): Bounds1D | undefined => {
  const { datasets } = data;

  if (datasets.size === 0) {
    return undefined;
  }

  return R.pipe(
    R.chain((dataset: TypedDataSet) => {
      const bounds = getXBounds(dataset.data);
      if (bounds == undefined) {
        return [];
      }
      return [bounds];
    }),
    combineBounds,
  )([...datasets.values()]);
};

/**
 * Get the ratio of one unit in viewport space to the number of pixels it
 * occupies.
 */
const getPixelSize = ({
  width,
  height,
  bounds: { x, y },
}: PlotViewport): { x: number; y: number } => ({
  x: (x.max - x.min) / width,
  y: (y.max - y.min) / height,
});

const isPartialState = (state: PathState) => state.isPartial;

type Lookup = ReturnType<typeof fastFindIndices>;

// Given a `value` representing a value on the x-axis, find the index of the
// point in the data set that is closest to that value using binary search.
const findIndexBinary = (
  lookup: Lookup,
  data: TypedData[],
  start: number,
  end: number,
  value: number,
): number | undefined => {
  if (start >= end) {
    return start;
  }

  const mid = Math.trunc((start + end) / 2);
  const pivotLocation = lookup(mid);
  if (pivotLocation == undefined) {
    return undefined;
  }

  const pivot = data[pivotLocation[0]]?.x[pivotLocation[1]];
  if (pivot == undefined) {
    return undefined;
  }

  if (value === pivot) {
    return mid;
  }

  return value < pivot
    ? findIndexBinary(lookup, data, start, mid - 1, value)
    : findIndexBinary(lookup, data, mid + 1, end, value);
};

/**
 * Check whether the point at `index` falls within `bounds`.
 */
/**
 * Get the portion of TypedData[] that falls within `bounds`.
 */
const sliceBounds = (data: TypedData[], bounds: Bounds1D): TypedData[] => {
  const lookup = fastFindIndices(data);
  const length = getTypedLength(data);
  const start = findIndexBinary(lookup, data, 0, length, bounds.min);
  if (start == undefined) {
    return data;
  }
  const end = findIndexBinary(lookup, data, 0, length, bounds.max);
  return sliceTyped(data, start, end);
};

const getVisibleBounds = (
  blockData: TypedDataSet | undefined,
  currentData: TypedDataSet | undefined,
): Bounds1D | undefined => {
  const allBounds = [];

  if (blockData != undefined) {
    const bounds = getXBounds(blockData.data);
    if (bounds != undefined) {
      allBounds.push(bounds);
    }
  }

  if (currentData != undefined) {
    const bounds = getXBounds(currentData.data);
    if (bounds != undefined) {
      allBounds.push(bounds);
    }
  }

  // Return undefined to indicate there are no visible bounds
  return allBounds.length !== 0 ? combineBounds(allBounds) : undefined;
};

const isDerivative = (path: PlotPath): boolean => path.value.endsWith(".@derivative");
const isHeaderStamp = (path: PlotPath): boolean => path.timestampMethod === "headerStamp";
const noop: (data: TypedData[]) => TypedData[] = R.identity;

// Apply any dataset-wide transformations, including sorting data points by
// their header stamps and calculating the derivative.
const applyTransforms = (data: TypedData[], path: PlotPath): TypedData[] =>
  R.pipe(
    isHeaderStamp(path) ? sortDataByHeaderStamp : noop,
    isDerivative(path) ? derivative : noop,
  )(data);

type SourceParams = {
  raw: TypedDataSet | undefined;
  view: PlotViewport;
  viewBounds: Bounds1D;
  maxPoints: number;
};

/**
 * updateSource processes new points for one path and one source (either block
 * or current data), doing a partial downsample of any new points.
 */
export function updateSource(
  path: PlotPath,
  params: SourceParams,
  state: SourceState,
): SourceState {
  const { raw, view, maxPoints } = params;
  const { cursor: oldCursor, downsampleState, dataset: previous } = state;
  if (raw == undefined) {
    return initSource();
  }

  const newCursor = getTypedLength(raw.data);
  if (newCursor === 0) {
    return initSource();
  }
  // the input data regressed for some reason, handle this gracefully
  if (newCursor < oldCursor) {
    return updateSource(path, params, initSource());
  }
  if (newCursor === oldCursor) {
    return state;
  }

  // We cannot downsample incrementally in these two scenarios, so we have to
  // fall back to doing it on every iteration.
  // 1. If the path uses `@derivative`, we need to calculate the derivative at
  // each point in the dataset. In order to avoid doing that from scratch every
  // time, we need to store the result of that calculation, which this state
  // machine currently cannot handle.
  // 2. When a path uses header stamps, we must sort the data points by their
  // header stamps before we can present them. This means that new points can
  // appear out-of-order and must be merged correctly into an existing, sorted
  // dataset that we hold on to, similar to what we would have to do for
  // derivatives.
  //
  // Both present serious drawbacks for memory, since we would have to store an
  // additional copy of the entire dataset with these transformations applied.
  if (isDerivative(path) || isHeaderStamp(path)) {
    const downsampled = downsampleDataset(applyTransforms(raw.data, path), view, maxPoints);
    if (downsampled == undefined) {
      return state;
    }
    return {
      ...initSource(),
      dataset: {
        ...raw,
        data: downsampled,
      },
    };
  }

  // The downsampling algorithm only works for series plots, not scatter plots.
  if (path.showLine === false) {
    const indices = downsampleScatter(iterateTyped(raw.data), view);
    const resolved = resolveTypedIndices(raw.data, indices);
    if (resolved == undefined) {
      return {
        ...initSource(),
        dataset: raw,
      };
    }

    return {
      ...initSource(),
      dataset: {
        ...raw,
        data: resolved,
      },
    };
  }

  const newData = sliceTyped(raw.data, oldCursor);
  const [indices, newDownsample] = continueDownsample(
    iterateTyped(newData),
    downsampleState ?? initTimeseries(view, maxPoints),
  );
  const resolved = resolveTypedIndices(raw.data, indices);
  if (resolved == undefined) {
    return state;
  }

  return {
    ...state,
    downsampleState: newDownsample,
    cursor: newCursor,
    dataset: {
      ...raw,
      pointRadius: 0,
      data: concatTyped(previous?.data ?? [], resolved),
    },
  };
}

/**
 * Merge together the block and current data for a signal, handling the case
 * where either one is undefined. This is conceptually similar to the merging
 * we do elsewhere but it operates on raw datasets.
 */
function resolveDataset(
  blocks: TypedDataSet | undefined,
  current: TypedDataSet | undefined,
): TypedDataSet | undefined {
  if (blocks == undefined && current == undefined) {
    return undefined;
  }

  if (blocks != undefined && current != undefined) {
    return {
      ...blocks,
      data: mergeTyped(blocks.data, current.data),
    };
  }

  if (blocks != undefined) {
    return blocks;
  }

  if (current != undefined) {
    return current;
  }

  return undefined;
}

type PathParameters = {
  blockData: TypedDataSet | undefined;
  currentData: TypedDataSet | undefined;
  view: PlotViewport;
  viewBounds: Bounds1D;
  maxPoints: number;
};

/**
 * When the dataset is only partially visible, we cut off the occluded portions
 * and downsample what's left.
 */
function updatePartialView(path: PlotPath, params: PathParameters, state: PathState): PathState {
  const { blockData, currentData, viewBounds, view, maxPoints } = params;

  const maxRange = viewBounds.max - viewBounds.min;
  const buffer = maxRange * ZOOM_RESET_FACTOR;
  const partialBounds = {
    min: viewBounds.min - buffer,
    max: viewBounds.max + buffer,
  };

  const mergedData = mergeTyped(blockData?.data ?? [], currentData?.data ?? []);
  const data = applyTransforms(sliceBounds(mergedData, partialBounds), path);
  const numSliced = getTypedLength(data);
  if (numSliced <= maxPoints) {
    return {
      ...state,
      isPartial: true,
      dataset: {
        ...(blockData ?? currentData),
        // pointRadius will be default
        data,
      },
    };
  }

  const downsampled = downsampleDataset(data, view, maxPoints);
  if (downsampled == undefined) {
    return state;
  }

  return {
    ...state,
    isPartial: true,
    dataset: {
      ...(blockData ?? currentData),
      pointRadius: 0,
      data: downsampled,
    },
  };
}

/**
 * Update the state of a single plot path by observing how block and current
 * data have changed and downsampling the new data as necessary. Both data
 * sources (block and current) are updated independently with updateSource.
 */
export function updatePath(path: PlotPath, params: PathParameters, state: PathState): PathState {
  const { blockData, currentData, view, viewBounds, maxPoints } = params;
  const { blocks, current, isPartial } = state;
  const combinedBounds = getVisibleBounds(blockData, currentData);
  if (combinedBounds != undefined) {
    // When the user's viewport ends before the end of the dataset, we only
    // show the data that is immediately visible and do not need to
    // incrementally downsample.
    const { min, max } = viewBounds;
    const range = max - min;
    // When we're streaming live data, it can cause us to switch into a partial
    // view of the dataset if we fall far enough behind, because the viewport
    // is stretched to fit the dataset by the main thread, but only with some
    // delay. Adding in leeway prevents that from happening, such that many
    // more points have to accumulate before our viewport changes to a partial
    // one.
    const leeway = range * ZOOM_RESET_FACTOR * 2;
    if (max !== min && max + leeway < combinedBounds.max) {
      return updatePartialView(path, params, state);
    }

    // If we're not partial anymore, we need to start over
    if (isPartial) {
      return updatePath(path, params, initPath());
    }
  }

  const newBlocks = updateSource(path, { raw: blockData, view, viewBounds, maxPoints }, blocks);

  // Skip computing current entirely if block data is bigger than it
  if (blockData != undefined && currentData != undefined) {
    const blockBounds = getXBounds(blockData.data);
    const currentBounds = getXBounds(currentData.data);

    if (blockBounds != undefined && currentBounds != undefined) {
      const canSkipCurrent = blockBounds.max >= currentBounds.max;
      if (canSkipCurrent) {
        return {
          ...state,
          current: initSource(),
          blocks: newBlocks,
          dataset: newBlocks.dataset,
        };
      }
    }
  }

  const newCurrent = updateSource(path, { raw: currentData, view, viewBounds, maxPoints }, current);
  const newState: PathState = {
    ...state,
    blocks: newBlocks,
    current: newCurrent,
  };

  return {
    ...newState,
    dataset: resolveDataset(newBlocks.dataset, newCurrent.dataset),
  };
}

/**
 * shouldResetViewport determines whether the viewport needs to be updated (and
 * thus whether downsampling should rerun.)
 */
export function shouldResetViewport(
  pathStates: PathState[],
  oldViewport: PlotViewport | undefined,
  newViewport: PlotViewport,
  dataBounds: Bounds1D | undefined,
): boolean {
  if (oldViewport == undefined) {
    return false;
  }

  const {
    bounds: { x: newBounds },
  } = newViewport;
  const {
    bounds: { x: oldBounds },
  } = oldViewport;

  // Special case for when the user moves the viewport beyond min of the
  // visible dataset
  if (oldBounds.max <= 0 && newBounds.max >= 0) {
    return true;
  }

  const havePartial = pathStates.some(isPartialState);
  if (havePartial) {
    const {
      bounds: { x: viewBounds },
    } = newViewport;

    const didPathReset = pathStates.some((state) => {
      if (!isPartialState(state)) {
        return false;
      }

      const { dataset } = state;
      if (dataset == undefined) {
        return false;
      }

      const pathBounds = getXBounds(dataset.data);
      if (pathBounds == undefined) {
        return false;
      }

      const maxRange = pathBounds.max - pathBounds.min;
      const innerStart = pathBounds.min + maxRange * ZOOM_RESET_FACTOR;
      const innerEnd = pathBounds.min + maxRange * (1 - ZOOM_RESET_FACTOR);

      return (
        viewBounds.min < pathBounds.min ||
        viewBounds.min > innerStart ||
        viewBounds.max > pathBounds.max ||
        viewBounds.max < innerEnd
      );
    });

    if (didPathReset) {
      return true;
    }
  }

  if (!R.equals(oldViewport.bounds.y, newViewport.bounds.y)) {
    return true;
  }

  const { x: oldX } = getPixelSize(oldViewport);
  const { x: newX } = getPixelSize(newViewport);
  const didZoom = Math.abs(newX / oldX - 1) > ZOOM_RESET_FACTOR;

  if (
    didZoom &&
    dataBounds != undefined &&
    newBounds.min <= dataBounds.min &&
    newBounds.max >= dataBounds.max
  ) {
    return false;
  }

  return didZoom;
}

/**
 * updateDownsample efficiently produces a downsampled dataset fit for
 * rendering by keeping track of the ways in which the user's viewport, block
 * data, and current data change.
 */
export function updateDownsample(
  view: PlotViewport,
  blocks: PlotData,
  current: PlotData,
  downsampled: Downsampled,
): Downsampled {
  const blockPaths = [...blocks.datasets.keys()];
  const currentPaths = [...current.datasets.keys()];
  const paths = blockPaths.length > currentPaths.length ? blockPaths : currentPaths;

  const stableView = downsampled.view ?? view;
  const {
    bounds: { x: viewBounds },
  } = stableView;
  const { view: downsampledView, data: previous, paths: oldPaths } = downsampled;

  const previousBounds = getPlotBounds(previous);
  const pathStates = R.chain((path) => {
    const state = oldPaths.get(path);
    if (state == undefined) {
      return [];
    }
    return [state];
  }, paths);
  if (shouldResetViewport(pathStates, downsampledView, view, previousBounds)) {
    return updateDownsample(view, blocks, current, initDownsampled());
  }

  const numDatasets = Math.max(blocks.datasets.size, current.datasets.size);
  if (numDatasets === 0) {
    return {
      ...initDownsampled(),
      // An empty plot is valid in this scenario, and should be rendered
      isValid: true,
    };
  }

  // The "maximum" number of buckets each dataset can have
  const pointsPerDataset = DESIRED_POINTS / numDatasets;

  const newPaths: PathMap<PathState> = new Map();
  const newDatasets: DatasetsByPath = new Map();
  for (const path of paths) {
    if (!path.enabled) {
      continue;
    }
    const oldState = oldPaths.get(path) ?? initPath();
    const newState = updatePath(
      path,
      {
        blockData: blocks.datasets.get(path),
        currentData: current.datasets.get(path),
        view: stableView,
        viewBounds,
        maxPoints: pointsPerDataset,
      },
      oldState,
    );
    newPaths.set(path, newState);

    const { dataset } = newState;
    if (dataset != undefined) {
      newDatasets.set(path, dataset);
    }
  }

  return {
    ...downsampled,
    data: {
      // Prefer properties from current data if it's around
      ...blocks,
      ...current,
      datasets: newDatasets,
    },
    paths: newPaths,
    view: downsampled.view ?? view,
    isValid: true,
  };
}
