// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Polygon, PolygonPoint } from "@foxglove/regl-worldview";
import { Point2D } from "@foxglove/studio-base/panels/ThreeDimensionalViz/DrawingTools";

export function polygonsToPoints(polygons: Polygon[]): Point2D[][] {
  return polygons.map((poly) => {
    return poly.points.map((point: { point: [number, number] }) => ({
      x: point.point[0],
      y: point.point[1],
    }));
  });
}

export function pointsToPolygons(polygonPoints: Point2D[][]): Polygon[] {
  // map the points back to polygons
  return polygonPoints.map((pointsPerPolygon, idx) => {
    const polygon = new Polygon(`${idx}`);
    polygon.points = pointsPerPolygon.map(({ x, y }) => new PolygonPoint([x, y, 0]));
    return polygon;
  });
}

function pointsToJson(polygonPoints: Point2D[][]): string {
  return JSON.stringify(polygonPoints, undefined, 2);
}

export function getFormattedString(polygonPoints: Point2D[][]): string {
  return pointsToJson(polygonPoints);
}

// calculate the sum of the line distances
export function getPolygonLineDistances(polygonPoints: Point2D[][]): number {
  let distance = 0;
  for (const polyPoints of polygonPoints) {
    for (let i = 0; i < polyPoints.length - 1; i++) {
      distance += Math.hypot(
        polyPoints[i + 1]!.x - polyPoints[i]!.x,
        polyPoints[i + 1]!.y - polyPoints[i]!.y,
      );
    }
  }
  return distance;
}
