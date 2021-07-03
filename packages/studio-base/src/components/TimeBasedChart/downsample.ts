// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChartData, ScatterDataPoint } from "chart.js";

import filterMap from "@foxglove/studio-base/util/filterMap";

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

export default function downsample(dataset: DataSet, bounds: DownsampleBounds): DataSet {
  // each datum point is treated as occupying a pixel
  const pixelPerXValue = bounds.width / (bounds.x.max - bounds.x.min);
  const pixelPerYValue = bounds.height / (bounds.y.max - bounds.y.min);

  // degenerate case
  if (dataset.data.length <= 1) {
    return dataset;
  }

  // scatter plot is easier to downsample, limit to 1 data point per 2 pixels using a sparse array
  if (dataset.showLine == undefined || !dataset.showLine) {
    const sparse2d: (boolean | undefined)[][] = [];
    const data = filterMap(dataset.data, (datum) => {
      // ignore missing or nan data for scatter plots
      if (!datum || isNaN(datum.x) || isNaN(datum.y)) {
        return datum;
      }

      // ignore out of bounds points
      if (
        datum.x < bounds.x.min ||
        datum.x > bounds.x.max ||
        datum.y < bounds.y.min ||
        datum.y > bounds.y.max
      ) {
        return;
      }

      const pixelX = Math.trunc(Math.abs(datum.x * pixelPerXValue));
      const pixelY = Math.trunc(Math.abs(datum.y * pixelPerYValue));

      if (sparse2d[pixelX]?.[pixelY] === true) {
        return;
      }

      (sparse2d[pixelX] = sparse2d[pixelX] ?? [])[pixelY] = true;
      return datum;
    });

    return { ...dataset, data };
  }

  // truncate to an appropriate range for the view bounds
  // important to keep the datum right outside our bounds on each side so lines go off screen to indicate
  // the data goes beyond the visible region
  let prevXPixel: number | undefined;
  let datumBucket: ScatterDataPoint[] = [];
  let minXDatum: ScatterDataPoint | undefined;
  let maxXDatum: ScatterDataPoint | undefined;

  // downsample the data while keeping _null_ data
  // null data points create _gaps_ in line charts for chart.js

  function reduceBucket(): ScatterDataPoint | undefined {
    if (datumBucket.length === 0) {
      return;
    }
    const firstDatum = datumBucket[0] as ScatterDataPoint;

    // 1 previous value, we just add that to output
    if (datumBucket.length === 1) {
      datumBucket = [];
      return firstDatum;
    }

    // many bucket values, avg them
    const yAvg = datumBucket.reduce((prev, curr) => prev + curr.y, 0) / datumBucket.length;
    // get the y value that is closet to the avg
    const closestDatum = datumBucket.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.y - yAvg);
      const currDiff = Math.abs(curr.y - yAvg);
      if (currDiff < prevDiff) {
        return curr;
      }
      return prev;
    }, firstDatum);

    datumBucket = [];
    return closestDatum;
  }

  const downsampled: (ScatterDataPoint | ChartNull)[] = [];
  dataset.data.forEach((datum) => {
    //const data = filterMap(dataset.data, (datum) => {
    if (!datum || isNaN(datum.x) || isNaN(datum.y)) {
      const reduced = reduceBucket();
      if (reduced) {
        downsampled.push(reduced);
      }

      // need to flush any previous value
      downsampled.push(datum);
      return;
    }

    // use the largest minimum value - the first outside our draw bounds
    // makes lines appear to go off screen to more data
    if (datum.x < bounds.x.min) {
      if (minXDatum == undefined || minXDatum.x < datum.x) {
        minXDatum = datum;
      }
      return;
    }

    // use the smallest maximum value - the first outside our draw bounds
    // makes lines appear to go off screen to more data
    if (datum.x > bounds.x.max) {
      if (maxXDatum == undefined || maxXDatum.x > datum.x) {
        maxXDatum = datum;
      }
      return;
    }

    const pixelX = Math.trunc(Math.abs(datum.x * pixelPerXValue));

    if (pixelX === prevXPixel) {
      datumBucket.push(datum);
    } else {
      // new datum is not at the same pixel location
      // add the previous bucket (reduced), and start a new bucket
      prevXPixel = pixelX;
      const reduced = reduceBucket();
      if (reduced) {
        downsampled.push(reduced);
      }
      datumBucket = [datum];
      return;
    }

    return;
  });

  // add last bucket with x/y datum
  const reduced = reduceBucket();
  if (reduced) {
    downsampled.push(reduced);
  }

  if (minXDatum) {
    downsampled.unshift(minXDatum);
  }
  if (maxXDatum) {
    downsampled.push(maxXDatum);
  }

  return { ...dataset, data: downsampled };
}
