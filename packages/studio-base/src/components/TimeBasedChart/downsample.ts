// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChartData, ScatterDataPoint } from "chart.js";

import { filterMap } from "@foxglove/den/collection";

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

type Point = { x: number; y: number };

function distanceSquared(p1: Point, p2: Point) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

export default function downsample(dataset: DataSet, bounds: DownsampleBounds): DataSet {
  // datasets of length 1 don't need downsampling
  if (dataset.data.length <= 1) {
    return dataset;
  }

  const pixelPerXValue = bounds.width / (bounds.x.max - bounds.x.min);
  const pixelPerYValue = bounds.height / (bounds.y.max - bounds.y.min);

  // ignore points if they are within 1 pixel of each other
  const threshold = 2;

  let prevPoint: { x: number; y: number } | undefined = undefined;
  const endIndex = dataset.data.length - 1;
  const downsampled = filterMap(dataset.data, (datum, index) => {
    if (!datum) {
      return datum;
    }

    const point = { x: datum.x * pixelPerXValue, y: datum.y * pixelPerYValue };
    if (!prevPoint) {
      prevPoint = point;
      return datum;
    }

    // Always keep the last data point
    if (index === endIndex) {
      return datum;
    }

    const pixelDistSq = distanceSquared(point, prevPoint);
    if (pixelDistSq < threshold) {
      return undefined;
    }

    prevPoint = point;
    return datum;
  });

  return { ...dataset, data: downsampled };
}
