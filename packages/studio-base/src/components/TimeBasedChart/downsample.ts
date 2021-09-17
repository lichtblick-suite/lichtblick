// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChartData, ScatterDataPoint } from "chart.js";

// Chartjs typings use _null_ to indicate _gaps_ in the dataset
// eslint-disable-next-line no-restricted-syntax
type ChartNull = null;
type Data = ChartData<"scatter", (ScatterDataPoint | ChartNull)[]>;
type DataSet = Data["datasets"][0];

type DownsampleBounds = {
  width: number;
  height: number;
  x: { min: number; max: number };
  y: { min: number; max: number };
};

/**
 * Downsample a timeseries dataset
 *
 * This function assumes the dataset x axis time and sorted.
 *
 * The downsampled data preserves the shape of the original data. The algorithm does this by
 * downsampling within an interval. Each interval tracks the first datum of the interval,
 * minimum y-value datum, maximum y-value datum, and the last datum of the interval.
 *
 * For each datum within the dataset, we determine first if it falls within the current interval.
 * - If the datum falls within the current interval we update the min/max y or last values. Then move
 *   to the next datum.
 * - If the datum falls outside the current interval, we determine whether to add the min/max and
 *   last datum to the downsampled dataset, and then move to the next datum.
 * - If first/min/max/last are all the same datum, then only one datum appears in the downsampled
 *   dataset.
 *
 * By tracking the first/min/max/last within an interval, the shape of the original data is preserved.
 * Points before the interval connect into the interval with the same slope line as the original
 * dataset, and the interval connects to the next interval with the same slope line as the original
 * data. The min/max entries preserve spikes within the data.
 */
export function downsampleTimeseries(dataset: DataSet, bounds: DownsampleBounds): DataSet {
  // datasets of length 1 don't need downsampling
  if (dataset.data.length <= 1) {
    return dataset;
  }

  const pixelPerXValue = bounds.width / (bounds.x.max - bounds.x.min);
  const pixelPerYValue = bounds.height / (bounds.y.max - bounds.y.min);

  const downsampled: ScatterDataPoint[] = [];

  type IntervalItem = { xPixel: number; yPixel: number; datum: ScatterDataPoint };

  let intFirst: IntervalItem | undefined;
  let intLast: IntervalItem | undefined;
  let intMin: IntervalItem | undefined;
  let intMax: IntervalItem | undefined;

  // We keep points within a buffer window around the bounds so points near the bounds are
  // connected to their peers and available for pan/zoom.
  // Points outside this buffer window are dropped.
  const xRange = bounds.x.max - bounds.x.min;
  const minX = bounds.x.min - xRange * 0.5;
  const maxX = bounds.x.max + xRange * 0.5;

  let firstPastBounds: typeof dataset.data[0] | undefined = undefined;

  for (const datum of dataset.data) {
    if (!datum) {
      continue;
    }

    // track the first point before our bounds
    if (datum.x < minX) {
      if (downsampled.length === 0) {
        downsampled.push(datum);
      } else {
        // the first point outside our bounds will always be at index 0
        downsampled[0] = datum;
      }
      continue;
    }

    // track the first point outside of our bounds
    if (datum.x > maxX) {
      firstPastBounds = datum;
      continue;
    }

    const x = Math.round(datum.x * pixelPerXValue);
    const y = Math.round(datum.y * pixelPerYValue);

    // interval has ended, we determine whether to write additional points for min/max/last
    if (intFirst?.xPixel !== x) {
      // add the min value from previous interval if it doesn't match the first or last of that interval
      if (intMin && intMin?.yPixel !== intFirst?.yPixel && intMin?.yPixel !== intLast?.yPixel) {
        downsampled.push(intMin?.datum);
      }

      // add the max value from previous interval if it doesn't match the first or last of that interval
      if (intMax && intMax?.yPixel !== intFirst?.yPixel && intMax?.yPixel !== intLast?.yPixel) {
        downsampled.push(intMax?.datum);
      }

      // add the last value if it doesn't match the first
      if (intLast && intFirst?.yPixel !== intLast?.yPixel) {
        downsampled.push(intLast.datum);
      }

      // always add the first datum of an new interval
      downsampled.push(datum);

      intFirst = intLast = { xPixel: x, yPixel: y, datum };
      intMin = { xPixel: x, yPixel: y, datum };
      intMax = { xPixel: x, yPixel: y, datum };
      continue;
    }

    intLast = { xPixel: x, yPixel: y, datum };

    if (intMin && y < intMin.yPixel) {
      intMin.yPixel = y;
      intMin.datum = datum;
    }

    if (intMax && y > intMax.yPixel) {
      intMax.yPixel = y;
      intMax.datum = datum;
    }
  }

  // add the min value from previous interval if it doesn't match the first or last of that interval
  if (intMin && intMin?.yPixel !== intFirst?.yPixel && intMin?.yPixel !== intLast?.yPixel) {
    downsampled.push(intMin?.datum);
  }

  // add the max value from previous interval if it doesn't match the first or last of that interval
  if (intMax && intMax?.yPixel !== intFirst?.yPixel && intMax?.yPixel !== intLast?.yPixel) {
    downsampled.push(intMax?.datum);
  }

  // add the last value if it doesn't match the first
  if (intLast && intFirst?.yPixel !== intLast?.yPixel) {
    downsampled.push(intLast.datum);
  }

  if (firstPastBounds) {
    downsampled.push(firstPastBounds);
  }

  return { ...dataset, data: downsampled };
}

export function downsampleScatter(dataset: DataSet, bounds: DownsampleBounds): DataSet {
  // datasets of length 1 don't need downsampling
  if (dataset.data.length <= 1) {
    return dataset;
  }

  const pixelPerXValue = bounds.width / (bounds.x.max - bounds.x.min);
  const pixelPerYValue = bounds.height / (bounds.y.max - bounds.y.min);
  const pixelPerRow = bounds.width;

  const downsampled: ScatterDataPoint[] = [];

  // downsampling tracks a sparse array of x/y locations
  const sparse: boolean[] = [];

  for (const datum of dataset.data) {
    if (!datum) {
      continue;
    }

    // out-of-bounds scatter points are ignored
    if (
      datum.x > bounds.x.max ||
      datum.x < bounds.x.min ||
      datum.y < bounds.y.min ||
      datum.y > bounds.y.max
    ) {
      continue;
    }

    const x = Math.round(datum.x * pixelPerXValue);
    const y = Math.round(datum.y * pixelPerYValue);

    // the locator is the x/y pixel value as one number
    const locator = y * pixelPerRow + x;
    if (sparse[locator] === true) {
      continue;
    }
    sparse[locator] = true;
    downsampled.push(datum);
  }

  return { ...dataset, data: downsampled };
}
