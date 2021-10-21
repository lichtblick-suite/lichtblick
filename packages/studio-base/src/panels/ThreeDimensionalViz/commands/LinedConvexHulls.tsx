// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import flatMap from "lodash/flatMap";
import uniqBy from "lodash/uniqBy";
import qh from "quickhull3d";

import { filterMap } from "@foxglove/den/collection";
import {
  Triangles,
  Lines,
  Line,
  TriangleList,
  CommonCommandProps,
  getChildrenForHitmapWithOriginalMarker,
  nonInstancedGetChildrenForHitmap,
  shouldConvert,
  pointToVec3,
  vec4ToRGBA,
  AssignNextColorsFn,
  MouseEventObject,
  Color,
} from "@foxglove/regl-worldview";

type Props = CommonCommandProps & {
  children: readonly Readonly<Line>[];
};

function getTriangleChildrenForHitmap(
  props: (Line & { originalMarker: Line })[],
  assignNextColors: AssignNextColorsFn,
  excludedObjects: MouseEventObject[],
): TriangleList[] {
  // This getChildrenForHitmap function takes lines and returns triangles.
  const triangles = filterMap(props, (line) => {
    // Make sure all points are in vec3 format and unique.
    const points = uniqBy(
      line.points.map((point) => (shouldConvert(point) ? pointToVec3(point) : point)),
      ([x, y, z]) => `${x}:${y}:${z}`,
    );
    // We need a minimum of 4 points to do the convex hull algorithm.
    if (points.length < 4) {
      return undefined;
    }
    // Try to run hulling on the face indices. If there is an error, discard the result.
    let faceIndices;
    try {
      faceIndices = qh(points);
    } catch (error) {
      console.error(error);
      return undefined;
    }

    // From the point indices of each face, find the points and flatmap to get the points of the triangles.
    const trianglePoints = flatMap(faceIndices, ([index1, index2, index3]) => {
      return [points[index1], points[index2], points[index3]];
    });
    const convertedColor =
      typeof (line.color! as Color).r === "number" ? line.color : vec4ToRGBA(line.color);
    return {
      pose: line.pose,
      scale: line.scale,
      color: convertedColor,
      points: trianglePoints,
      originalMarker: line.originalMarker,
    };
  });

  return getChildrenForHitmapWithOriginalMarker(triangles, assignNextColors, excludedObjects);
}

export default function LinedConvexHulls({ children, ...rest }: Props): JSX.Element {
  return (
    <>
      {/* Render all the lines, even if we can't generate a convex hull from them. */}
      <Lines getChildrenForHitmap={nonInstancedGetChildrenForHitmap} {...rest}>
        {children}
      </Lines>
      <Triangles getChildrenForHitmap={getTriangleChildrenForHitmap} {...rest}>
        {/*
         * These Line objects are not renderable by the Triangle shader. But since we're only rendering them inside the
         * hitmap, we convert them from lines to triangle objects in the `getTriangleChildrenForHitmap` function above.
         */}
        {children.map((line) => ({ ...line, originalMarker: line, onlyRenderInHitmap: true }))}
      </Triangles>
    </>
  );
}
