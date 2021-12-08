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
import {
  CoordinateFrame,
  TransformTree,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";
import {
  Marker,
  ArrowMarker,
  Color,
  MutablePose,
  Point,
} from "@foxglove/studio-base/types/Messages";
import { MarkerProvider, MarkerCollector } from "@foxglove/studio-base/types/Scene";
import { clonePose, emptyPose, setIdentityPose } from "@foxglove/studio-base/util/Pose";
import { MARKER_MSG_TYPES } from "@foxglove/studio-base/util/globalConstants";

const defaultArrowMarker = {
  id: "",
  header: {
    frame_id: "",
    stamp: {
      sec: 0,
      nsec: 0,
    },
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
  color: Color;
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
  srcFrame: CoordinateFrame,
  axis: Axis,
  renderFrame: CoordinateFrame,
  time: Time,
) => {
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

  renderFrame.apply(pose, pose, srcFrame, time);

  return {
    ...axis,
    id: `${id}-${axisId}axis`,
    name: `${id}-${axisId}axis`,
    pose,
  };
};

const getAxesArrowMarkers = (
  id: string,
  srcFrame: CoordinateFrame,
  renderFrame: CoordinateFrame,
  time: Time,
): ArrowMarker[] => {
  return originAxes.map((axis) =>
    getTransformedAxisArrowMarker(id, srcFrame, axis, renderFrame, time),
  );
};

const getAxisTextMarker = (id: string, pose: MutablePose): Marker => {
  const textPose = clonePose(pose);
  // Lower it a little in world coordinates so it appears slightly below the axis origin (like in rviz).
  textPose.position.z = textPose.position.z - 0.02;
  return {
    header: {
      frame_id: "",
      stamp: {
        sec: 0,
        nsec: 0,
      },
      seq: 0,
    },
    ns: "tf-axes",
    action: 0,
    scale: { x: 1, y: 1, z: 1 },
    color: { r: 1, g: 1, b: 1, a: 1 },
    id: `${id}-name`,
    // @ts-expect-error should name exist on marker?
    name: `${id}-name`,
    pose: textPose,
    type: MARKER_MSG_TYPES.TEXT_VIEW_FACING,
    text: id,
  };
};

// So we don't create a lot of effectively unused vectors / quats.
const UNUSED_QUAT = { x: 0, y: 0, z: 0, w: 1 };

// Exported for tests
export const getArrowToParentMarker = (
  id: string,
  srcFrame: CoordinateFrame,
  renderFrame: CoordinateFrame,
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
    !renderFrame.apply(childPose, childPose, srcFrame, time) ||
    !renderFrame.apply(parentPose, parentPose, parent, time)
  ) {
    return undefined;
  }

  // If the distance between the parent and child is 0, skip drawing an arrow between them.
  if (pointsEqual(childPose.position, parentPose.position)) {
    return undefined;
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
  transforms?: TransformTree;
  renderFrameId?: string;
  selections: string[] = [];

  setTransforms = (transforms: TransformTree, renderFrameId: string | undefined): void => {
    this.transforms = transforms;
    this.renderFrameId = renderFrameId;
  };

  addMarkersForTransform(
    add: MarkerCollector,
    id: string,
    srcFrame: CoordinateFrame,
    renderFrame: CoordinateFrame,
    time: Time,
  ): void {
    setIdentityPose(tempPose);

    // If renderFrame_T_srcFrame is invalid at the given time, don't draw anything
    if (!renderFrame.apply(tempPose, tempPose, srcFrame, time)) {
      return;
    }

    const markersForTransform: Marker[] = getAxesArrowMarkers(id, srcFrame, renderFrame, time);
    const arrowMarker = getArrowToParentMarker(id, srcFrame, renderFrame, time);
    if (arrowMarker) {
      markersForTransform.push(arrowMarker);
    }
    markersForTransform.push(getAxisTextMarker(id, tempPose));

    for (const marker of markersForTransform) {
      switch (marker.type) {
        case 0:
          add.arrow(marker);
          break;
        case 9:
          add.text(marker);
          break;
        default:
          console.warn("Marker for transform not supported", marker);
      }
    }
  }

  setSelectedTransforms(selections: string[]): void {
    this.selections = selections;
  }

  renderMarkers = (add: MarkerCollector, time: Time): void => {
    const { selections, transforms } = this;
    if (transforms == undefined || this.renderFrameId == undefined) {
      return;
    }
    for (const key of selections) {
      const srcFrame = transforms.frame(key);
      const renderFrame = transforms.frame(this.renderFrameId);
      if (srcFrame && renderFrame) {
        this.addMarkersForTransform(add, key, srcFrame, renderFrame, time);
      }
    }
  };
}

function pointsEqual(a: Point, b: Point): boolean {
  const EPSILON = 0.000001; // From gl-matrix
  return (
    Math.abs(a.x - b.x) <= EPSILON * Math.max(1.0, Math.abs(a.x), Math.abs(b.x)) &&
    Math.abs(a.y - b.y) <= EPSILON * Math.max(1.0, Math.abs(a.y), Math.abs(b.y)) &&
    Math.abs(a.z - b.z) <= EPSILON * Math.max(1.0, Math.abs(a.z), Math.abs(b.z))
  );
}
