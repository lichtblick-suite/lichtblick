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

import { quat, vec3 } from "gl-matrix";

import { Time } from "@foxglove/rostime";
import { IImmutableCoordinateFrame } from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";
import { ArrowMarker, MutablePose, Point, TextMarker } from "@foxglove/studio-base/types/Messages";
import { clonePose, emptyPose, setIdentityPose } from "@foxglove/studio-base/util/Pose";
import { MARKER_MSG_TYPES } from "@foxglove/studio-base/util/globalConstants";

import { MarkerProvider, MarkerCollector, RenderMarkerArgs } from "./types";

// So we don't create a lot of effectively unused vectors / quats.
const UNUSED_QUAT = { x: 0, y: 0, z: 0, w: 1 };

// Don't draw lines longer than this, to avoid precision issues
const MAX_DISTANCE = 5000;

const defaultArrowMarker = {
  id: "",
  header: {
    frame_id: "",
    stamp: { sec: 0, nsec: 0 },
    seq: 0,
  },
  ns: "tf-axes",
  type: 0,
  action: 0,
};

const defaultArrowScale = { x: 0.2, y: 0.02, z: 0.02 };
const unitXVector = [1, 0, 0];
const tempPose = emptyPose();
const tempOrientation = [0, 0, 0, 0] as [number, number, number, number];

type Axis = ArrowMarker & {
  id: string;
  unitVector: vec3;
};

const originAxes: Axis[] = [
  {
    ...defaultArrowMarker,
    scale: { ...defaultArrowScale },
    pose: emptyPose(),
    id: "X",
    color: { r: 1, g: 0, b: 0, a: 1 },
    unitVector: [1, 0, 0],
  } as Axis,
  {
    ...defaultArrowMarker,
    scale: { ...defaultArrowScale },
    pose: emptyPose(),
    id: "Y",
    color: { r: 0, g: 1, b: 0, a: 1 },
    unitVector: [0, 1, 0],
  } as Axis,
  {
    ...defaultArrowMarker,
    scale: { ...defaultArrowScale },
    pose: emptyPose(),
    id: "Z",
    color: { r: 0, g: 0, b: 1, a: 1 },
    unitVector: [0, 0, 1],
  } as Axis,
];

const getTransformedAxisArrowMarker = (
  id: string,
  axis: Axis,
  renderFrame: IImmutableCoordinateFrame,
  fixedFrame: IImmutableCoordinateFrame,
  srcFrame: IImmutableCoordinateFrame,
  time: Time,
): ArrowMarker => {
  const { unitVector, id: axisId } = axis;
  quat.rotationTo(tempOrientation, unitXVector, unitVector);
  const pose = {
    position: { x: 0, y: 0, z: 0 },
    orientation: {
      x: tempOrientation[0],
      y: tempOrientation[1],
      z: tempOrientation[2],
      w: tempOrientation[3],
    },
  };

  renderFrame.apply(pose, pose, fixedFrame, srcFrame, time, time);

  return { ...axis, id: `${id}-${axisId}axis`, pose };
};

const getAxesArrowMarkers = (
  id: string,
  renderFrame: IImmutableCoordinateFrame,
  fixedFrame: IImmutableCoordinateFrame,
  srcFrame: IImmutableCoordinateFrame,
  time: Time,
): ArrowMarker[] => {
  return originAxes.map((axis) =>
    getTransformedAxisArrowMarker(id, axis, renderFrame, fixedFrame, srcFrame, time),
  );
};

const getAxisTextMarker = (id: string, pose: MutablePose): TextMarker => {
  const textPose = clonePose(pose);
  // Lower it a little in world coordinates so it appears slightly below the axis origin (like in rviz).
  textPose.position.z -= 0.02;
  return {
    header: {
      frame_id: "",
      stamp: { sec: 0, nsec: 0 },
      seq: 0,
    },
    ns: "tf-axes",
    action: 0,
    scale: { x: 1, y: 1, z: 1 },
    color: { r: 1, g: 1, b: 1, a: 1 },
    id: `${id}-name`,
    pose: textPose,
    type: MARKER_MSG_TYPES.TEXT_VIEW_FACING,
    text: id,
    frame_locked: true,
  };
};

function pointsEqual(a: Point, b: Point): boolean {
  const EPSILON = 0.000001; // From gl-matrix
  return (
    Math.abs(a.x - b.x) <= EPSILON * Math.max(1.0, Math.abs(a.x), Math.abs(b.x)) &&
    Math.abs(a.y - b.y) <= EPSILON * Math.max(1.0, Math.abs(a.y), Math.abs(b.y)) &&
    Math.abs(a.z - b.z) <= EPSILON * Math.max(1.0, Math.abs(a.z), Math.abs(b.z))
  );
}

function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function reproject(a: Point, b: Point, distance: number): Point {
  // Subtract a from b, then normalize the result
  const diff = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const length = Math.sqrt(diff.x * diff.x + diff.y * diff.y + diff.z * diff.z);
  if (length > 0) {
    diff.x /= length;
    diff.y /= length;
    diff.z /= length;
  }

  // Scale the result by the distance
  return { x: a.x + diff.x * distance, y: a.y + diff.y * distance, z: a.z + diff.z * distance };
}

// Exported for tests
export const getArrowToParentMarker = (
  id: string,
  renderFrame: IImmutableCoordinateFrame,
  fixedFrame: IImmutableCoordinateFrame,
  srcFrame: IImmutableCoordinateFrame,
  time: Time,
): ArrowMarker | undefined => {
  const parent = srcFrame.parent();
  if (!parent) {
    return undefined;
  }

  const childPose: MutablePose = {
    position: { x: 0, y: 0, z: 0 },
    orientation: UNUSED_QUAT,
  };
  const parentPose: MutablePose = {
    position: { x: 0, y: 0, z: 0 },
    orientation: UNUSED_QUAT,
  };

  if (
    !renderFrame.apply(childPose, childPose, fixedFrame, srcFrame, time, time) ||
    !renderFrame.apply(parentPose, parentPose, fixedFrame, parent, time, time)
  ) {
    return undefined;
  }

  // If the distance between the parent and child is 0, skip drawing an arrow between them.
  if (pointsEqual(childPose.position, parentPose.position)) {
    return undefined;
  }

  // If the
  if (distanceSquared(childPose.position, parentPose.position) > MAX_DISTANCE * MAX_DISTANCE) {
    parentPose.position = reproject(childPose.position, parentPose.position, MAX_DISTANCE);
  }

  return {
    ...defaultArrowMarker,
    pose: emptyPose(),
    id: `${id}-childToParentArrow`,
    color: { r: 1, g: 1, b: 0, a: 1 },
    points: [childPose.position, parentPose.position],
    scale: {
      // Intentionally different scale from the other arrows, to make the arrow head reasonable.
      x: 0.02,
      y: 0.01,
      z: 0.05,
    },
    frame_locked: true,
  } as ArrowMarker;
};

export default class TransformsBuilder implements MarkerProvider {
  private selections: string[] = [];

  public addMarkersForTransform(
    add: MarkerCollector,
    id: string,
    renderFrame: IImmutableCoordinateFrame,
    fixedFrame: IImmutableCoordinateFrame,
    srcFrame: IImmutableCoordinateFrame,
    time: Time,
  ): void {
    setIdentityPose(tempPose);

    // If renderFrame_T_srcFrame is invalid at the given time, don't draw anything
    if (!renderFrame.apply(tempPose, tempPose, fixedFrame, srcFrame, time, time)) {
      return;
    }

    // Three RGB axis arrows
    for (const marker of getAxesArrowMarkers(id, renderFrame, fixedFrame, srcFrame, time)) {
      add.arrow(marker);
    }

    // A yellow arrow connecting this axis to its parent
    const parent = srcFrame.parent();
    if (parent && this.selections.includes(parent.id)) {
      const arrowMarker = getArrowToParentMarker(id, renderFrame, fixedFrame, srcFrame, time);
      if (arrowMarker) {
        add.arrow(arrowMarker);
      }
    }

    // Text label
    add.text(getAxisTextMarker(id, tempPose));
  }

  public setSelectedTransforms(selections: string[]): void {
    this.selections = selections;
  }

  public renderMarkers = (args: RenderMarkerArgs): void => {
    const { add, renderFrame, fixedFrame, transforms, time } = args;

    for (const key of this.selections) {
      const srcFrame = transforms.frame(key);
      if (srcFrame) {
        this.addMarkersForTransform(add, key, renderFrame, fixedFrame, srcFrame, time);
      }
    }
  };
}
