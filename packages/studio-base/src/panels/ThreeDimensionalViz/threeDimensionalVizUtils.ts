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

import { quat } from "gl-matrix";
// eslint-disable-next-line no-restricted-imports
import { mergeWith, get } from "lodash";

import {
  CameraState,
  Vec3,
  Vec4,
  MouseEventObject,
  DEFAULT_CAMERA_STATE,
} from "@foxglove/regl-worldview";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { InteractionData } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import { LinkedGlobalVariables } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import { IImmutableTransformTree } from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";
import { FollowMode } from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { InstancedLineListMarker, MutablePose } from "@foxglove/studio-base/types/Messages";

type TargetPose = { target: Vec3; targetOrientation: Vec4 };

type MutableVec4 = [number, number, number, number];

// Get the camera target position and orientation
function getTargetPose(
  followTf: string | undefined,
  transforms: IImmutableTransformTree,
): TargetPose | undefined {
  if (followTf != undefined && transforms.hasFrame(followTf)) {
    return { target: [0, 0, 0], targetOrientation: [0, 0, 0, 1] };
  }
  return undefined;
}

function invertOrientation(out: MutableVec4, orientation: quat): Vec4 {
  // For normalized quaternions, the conjugate is faster than inverse and
  // produces the same result
  quat.conjugate(out, orientation);
  return out;
}

export function useTransformedCameraState({
  configCameraState,
  followTf,
  followMode,
  transforms,
  poseInRenderFrame,
}: {
  configCameraState: Partial<CameraState>;
  followTf?: string;
  followMode: FollowMode;
  transforms: IImmutableTransformTree;
  poseInRenderFrame?: MutablePose;
}): CameraState {
  const transformedCameraState = { ...configCameraState };
  const targetPose = getTargetPose(followTf, transforms);

  switch (followMode) {
    case "follow": {
      transformedCameraState.target = targetPose?.target;
      if (poseInRenderFrame) {
        const o = poseInRenderFrame.orientation;
        transformedCameraState.targetOrientation = invertOrientation(
          [0, 0, 0, 1],
          [o.x, o.y, o.z, o.w],
        );
      } else {
        transformedCameraState.targetOrientation = undefined;
      }
      break;
    }
    case "follow-orientation": {
      transformedCameraState.target = targetPose?.target;
      transformedCameraState.targetOrientation = targetPose?.targetOrientation;
      break;
    }
    case "no-follow": {
      if (poseInRenderFrame) {
        const p = poseInRenderFrame.position;
        const o = poseInRenderFrame.orientation;
        transformedCameraState.target = [p.x, p.y, p.z];
        transformedCameraState.targetOrientation = invertOrientation(
          [0, 0, 0, 1],
          [o.x, o.y, o.z, o.w],
        );
      } else {
        transformedCameraState.target = undefined;
        transformedCameraState.targetOrientation = undefined;
      }
      break;
    }
  }

  const mergedCameraState = mergeWith(
    transformedCameraState,
    DEFAULT_CAMERA_STATE,
    (objVal, srcVal) => objVal ?? srcVal,
  );

  return mergedCameraState;
}

export const getInstanceObj = (marker: unknown, idx: number): unknown => {
  if (marker == undefined) {
    return;
  }
  return (marker as InstancedLineListMarker).metadataByIndex?.[idx];
};

export const getObject = (selectedObject?: MouseEventObject): unknown => {
  const object =
    (selectedObject?.instanceIndex != undefined &&
      (selectedObject.object as InstancedLineListMarker).metadataByIndex != undefined &&
      getInstanceObj(selectedObject.object, selectedObject.instanceIndex)) ||
    selectedObject?.object;
  return object;
};

export const getInteractionData = (
  selectedObject?: MouseEventObject,
): InteractionData | undefined =>
  (selectedObject?.object as { interactionData?: InteractionData } | undefined)?.interactionData ??
  (getObject(selectedObject) as { interactionData?: InteractionData } | undefined)?.interactionData;

export function getUpdatedGlobalVariablesBySelectedObject(
  selectedObject: MouseEventObject,
  linkedGlobalVariables: LinkedGlobalVariables,
): GlobalVariables | undefined {
  const object = getObject(selectedObject);
  const interactionData = getInteractionData(selectedObject);
  if (
    linkedGlobalVariables.length === 0 ||
    !interactionData ||
    interactionData.topic.length === 0
  ) {
    return;
  }
  const newGlobalVariables: GlobalVariables = {};
  linkedGlobalVariables.forEach(({ topic, markerKeyPath, name }) => {
    if (interactionData.topic === topic) {
      const objectForPath = get(object, [...markerKeyPath].reverse());
      newGlobalVariables[name] = objectForPath;
    }
  });
  return newGlobalVariables;
}

export function getNewCameraStateOnFollowChange({
  prevCameraState,
  prevFollowTf,
  prevFollowMode = "follow",
  newFollowTf,
  newFollowMode = "follow",
}: {
  prevCameraState: Partial<CameraState>;
  prevFollowTf?: string;
  prevFollowMode?: FollowMode;
  newFollowTf?: string;
  newFollowMode?: FollowMode;
}): Partial<CameraState> {
  // Neither the followTf or followMode changed, there is nothing to updated with the camera state
  if (newFollowMode === prevFollowMode && prevFollowTf === newFollowTf) {
    return prevCameraState;
  }

  // Any change in the follow tf resets the target offset so we snap to the new follow tf
  if (newFollowTf !== prevFollowTf) {
    return { ...prevCameraState, targetOffset: [0, 0, 0] };
  }

  // When entering a follow mode, reset the camera so it snaps to the frame we are rendering
  if (prevFollowMode === "no-follow" && newFollowMode !== "no-follow") {
    return { ...prevCameraState, targetOffset: [0, 0, 0] };
  }

  return prevCameraState;
}
