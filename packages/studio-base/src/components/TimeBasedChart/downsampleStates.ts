// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { Immutable } from "@foxglove/studio";
import { Point } from "@foxglove/studio-base/components/Chart/datasets";

import { calculateIntervals } from "./downsample";
import type { PlotViewport } from "./types";

// Represents a point corresponding to a State Transition segment.
export type StatePoint = {
  // The x-coordinate of the point in the coordinate frame of the plot
  x: number;
  // The index of a point in the original dataset whose properties this segment
  // should include. If this is undefined, this segment consists of more than
  // one states and it should be rendered as such.
  index: number | undefined;
  states?: string[];
};

type Label = {
  // The index at which this label first appeared
  index: number;
  // The value of the label
  value: string;
};

/**
 * Add a Label to a list of Labels, but not if the top of the new Label's value
 * matches the value of the Label at the top of the stack.
 */
function addLabel(label: Label, labels: Immutable<Label[]>): Immutable<Label[]> {
  const last = labels.at(-1);
  if (last != undefined && label.value === last.value) {
    return labels;
  }

  return [...labels, label];
}

// Contains all of the state we need to keep track of for each interval.
type Interval = {
  // The x coordinate of the beginning of the interval
  x: number;
  // The pixel coordinate of the beginning of the interval
  xPixel: number;
  // The x coordinate of the end of the interval
  endX: number;
  // All of the labels that appeared in this interval
  labels: Immutable<Label[]>;
  // The index of the point that started the interval
  index: number;
};

/**
 * Downsample state transition data by breaking the visible bounds into a set
 * of evenly-sized intervals and making a note of the number of state
 * transitions (between distinct states) that occur in each.
 *
 * If just one occurs, we return a StatePoint with x == the x-coordinate of the
 * single state transition point and index == the index of that point.
 *
 * If more than one does, it's represented in the output as two StatePoints:
 * one that matches the first point found in the interval (except with index ==
 * undefined) and another that matches the _last_ point in the interval, with x
 * == the end of the interval in the coordinate frame of the plot.
 *
 * This allows the caller to render intervals that contain more state
 * transitions than we can safely render in a different way to make it obvious
 * to the user that there is more detail.
 *
 * The `maxPoints` parameter works identically to the way it does in
 * `downsampleTimeseries`.
 */
export function downsampleStates(
  points: Iterable<Point>,
  view: PlotViewport,
  maxPoints?: number,
): StatePoint[] {
  const { bounds } = view;
  const { pixelPerXValue } = calculateIntervals(view, 2, maxPoints);
  const xValuePerPixel = 1 / pixelPerXValue;

  const indices: StatePoint[] = [];
  let interval: Interval | undefined;

  // We keep points within a buffer window around the bounds so points near the bounds are
  // connected to their peers and available for pan/zoom.
  // Points outside this buffer window are dropped.
  const xRange = bounds.x.max - bounds.x.min;
  const minX = bounds.x.min - xRange * 0.5;
  const maxX = bounds.x.max + xRange * 0.5;

  let firstPastBounds: number | undefined = undefined;

  /**
   * Conclude the current interval, producing one or more StatePoint.
   *
   * If the interval contained just one state, we leave the original point in
   * place.
   *
   * If the interval contained multiple states, we produce two points:
   * * One at the x-value of the first point in the interval
   * * One at the x-value of the end of the interval (which is not a real point)
   * This allows the renderer to draw a gray line segment between these two points.
   */
  const finishInterval = () => {
    if (interval == undefined) {
      return;
    }

    const { labels, endX } = interval;
    const [first] = labels;
    const last = labels.at(-1);
    const haveMultiple = labels.length > 1;

    if (first == undefined || last == undefined) {
      return;
    }

    indices.push({
      x: interval.x,
      index: haveMultiple ? undefined : first.index,
      ...(haveMultiple ? { states: R.uniq(labels.map(({ value }) => value)) } : undefined),
    });

    if (!haveMultiple) {
      return;
    }

    indices.push({
      x: endX,
      index: last.index,
    });
  };

  for (const datum of points) {
    const { index, label, x } = datum;

    // track the first point before our bounds
    if (datum.x < minX) {
      const point = {
        index,
        x,
      };
      if (indices.length === 0) {
        indices.push(point);
      } else {
        indices[0] = point;
      }
      continue;
    }

    // track the first point outside of our bounds
    if (datum.x > maxX) {
      firstPastBounds = index;
      continue;
    }

    // This only seems to occur when we've inserted a dummy final point, which
    // we need to add
    if (label == undefined) {
      indices.push({
        x,
        index,
      });
      continue;
    }

    const xPixel = Math.trunc(x * pixelPerXValue);
    const isNew = interval?.xPixel !== xPixel;
    if (interval != undefined && isNew) {
      finishInterval();
    }

    // Start a new interval if this point falls in a new one
    if (interval == undefined || isNew) {
      interval = {
        x,
        endX: xPixel * xValuePerPixel + xValuePerPixel,
        xPixel,
        index,
        labels: [
          {
            index,
            value: label,
          },
        ],
      };
      continue;
    }

    // If we haven't yet moved on, add this point's label
    interval.labels = addLabel(
      {
        index,
        value: label,
      },
      interval.labels,
    );
  }

  if (interval != undefined) {
    finishInterval();
  }

  if (firstPastBounds != undefined) {
    indices.push({
      x: maxX,
      index: firstPastBounds,
    });
  }

  return indices;
}
