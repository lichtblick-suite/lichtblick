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
import { mat4, vec3 } from "gl-matrix";
import { memo, ReactElement } from "react";

import {
  Arrows,
  pointToVec3,
  vec3ToPoint,
  orientationToVec4,
  CommonCommandProps,
  Pose,
  Vec3,
} from "@foxglove/regl-worldview";
import { PoseSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PoseSettingsEditor";
import {
  NormalizedPose,
  NormalizedPoseArray,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

const DEFAULT_COLOR = { r: 124 / 255, g: 107 / 255, b: 255 / 255, a: 0.5 };
const DEFAULT_SIZE = { shaftLength: 1, shaftWidth: 0.05, headWidth: 0.2, headLength: 0.3 };

type PoseMarkerProps = CommonCommandProps & {
  markers: Array<
    ((NormalizedPose & { type: 103 }) | (NormalizedPoseArray & { pose: Pose; type: 111 })) & {
      settings?: PoseSettings;
    }
  >;
};

function makeArrow(
  marker: PoseMarkerProps["markers"][0],
  instancePose: Pose | undefined,
): React.ReactNode {
  const headLength = marker.settings?.size?.headLength ?? DEFAULT_SIZE.headLength;
  const newMarker = {
    ...marker,
    color: marker.settings?.overrideColor ?? DEFAULT_COLOR,
    scale: {
      x: marker.settings?.size?.shaftWidth ?? DEFAULT_SIZE.shaftWidth,
      y: marker.settings?.size?.headWidth ?? DEFAULT_SIZE.headWidth,
      z: headLength,
    },
  };

  const transform = mat4.fromRotationTranslation(
    mat4.create(),
    orientationToVec4(marker.pose.orientation),
    pointToVec3(marker.pose.position),
  );
  if (instancePose) {
    const instanceTransform = mat4.fromRotationTranslation(
      mat4.create(),
      orientationToVec4(instancePose.orientation),
      pointToVec3(instancePose.position),
    );
    mat4.multiply(transform, transform, instanceTransform);
  }
  const shaftLength = marker.settings?.size?.shaftLength ?? DEFAULT_SIZE.shaftLength;
  const tailPoint = vec3.transformMat4([0, 0, 0], [0, 0, 0], transform) as Vec3;
  const tipPoint = vec3.transformMat4(
    [0, 0, 0],
    [shaftLength + headLength, 0, 0],
    transform,
  ) as Vec3;
  return {
    ...newMarker,
    // Reset the pose since this information is incorporated into the arrow tip and tail
    pose: emptyPose(),
    points: [vec3ToPoint(tailPoint), vec3ToPoint(tipPoint)],
  };
}

function PoseMarkers({ markers, layerIndex }: PoseMarkerProps): ReactElement {
  const arrowMarkers: React.ReactNode[] = [];
  for (const marker of markers) {
    if (marker.type === 111) {
      for (const instancePose of marker.poses) {
        arrowMarkers.push(makeArrow(marker, instancePose));
      }
    } else {
      arrowMarkers.push(makeArrow(marker, undefined));
    }
  }

  return <Arrows layerIndex={layerIndex}>{arrowMarkers}</Arrows>;
}

export default memo(PoseMarkers);
