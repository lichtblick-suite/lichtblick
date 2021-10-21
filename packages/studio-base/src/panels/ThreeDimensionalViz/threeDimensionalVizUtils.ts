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

import { vec3 } from "gl-matrix";
// eslint-disable-next-line no-restricted-imports
import { mergeWith, get } from "lodash";
import { useRef } from "react";

import {
  CameraState,
  Vec3,
  Vec4,
  MouseEventObject,
  cameraStateSelectors,
  DEFAULT_CAMERA_STATE,
} from "@foxglove/regl-worldview";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { InteractionData } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import { LinkedGlobalVariables } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import Transforms from "@foxglove/studio-base/panels/ThreeDimensionalViz/Transforms";
import { InstancedLineListMarker, MutablePose } from "@foxglove/studio-base/types/Messages";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

export type TargetPose = { target: Vec3; targetOrientation: Vec4 };

const ZOOM_LEVEL_URL_PARAM = "zoom";

function getZoomDistanceFromURLParam(): number | undefined {
  const params = new URLSearchParams(location?.search);
  if (params.has(ZOOM_LEVEL_URL_PARAM)) {
    return parseFloat(params.get(ZOOM_LEVEL_URL_PARAM) as string);
  }
  return undefined;
}

// Get the camera target position and orientation
export function getTargetPose(
  followTf: string | false | undefined,
  transforms: Transforms,
): TargetPose | undefined {
  if (typeof followTf === "string" && followTf.length > 0 && transforms.has(followTf)) {
    let pose: MutablePose | undefined = emptyPose();
    pose = transforms.apply(pose, pose, followTf, transforms.rootOfTransform(followTf).id);
    if (pose) {
      const { x: px, y: py, z: pz } = pose.position;
      const { x: ox, y: oy, z: oz, w: ow } = pose.orientation;
      return {
        target: [px, py, pz],
        targetOrientation: [ox, oy, oz, ow],
      };
    }
  }
  return undefined;
}

export function useTransformedCameraState({
  configCameraState,
  followTf,
  followOrientation,
  transforms,
}: {
  configCameraState: Partial<CameraState>;
  followTf?: string | false;
  followOrientation: boolean;
  transforms: Transforms;
}): { transformedCameraState: CameraState; targetPose?: TargetPose } {
  const transformedCameraState = { ...configCameraState };
  const targetPose = getTargetPose(followTf, transforms);
  // Store last seen target pose because the target may become available/unavailable over time as
  // the player changes, and we want to avoid moving the camera when it disappears.
  const lastTargetPoseRef = useRef<TargetPose | undefined>();
  const lastTargetPose = lastTargetPoseRef.current;
  // Recompute cameraState based on the new inputs at each render
  if (targetPose) {
    lastTargetPoseRef.current = targetPose;
    transformedCameraState.target = targetPose.target;
    if (followOrientation) {
      transformedCameraState.targetOrientation = targetPose.targetOrientation;
    }
  } else if (typeof followTf === "string" && followTf.length > 0 && lastTargetPose) {
    // If follow is enabled but no target is available (such as when seeking), keep the camera
    // position the same as it would have been by reusing the last seen target pose.
    transformedCameraState.target = lastTargetPose.target;
    if (followOrientation) {
      transformedCameraState.targetOrientation = lastTargetPose.targetOrientation;
    }
  }
  // Read the distance from URL when World is first loaded with empty cameraState distance in savedProps
  if (configCameraState.distance == undefined) {
    transformedCameraState.distance = getZoomDistanceFromURLParam();
  }

  const mergedCameraState = mergeWith(
    transformedCameraState,
    DEFAULT_CAMERA_STATE,
    (objVal, srcVal) => objVal ?? srcVal,
  );

  return { transformedCameraState: mergedCameraState, targetPose: targetPose ?? lastTargetPose };
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
  (selectedObject?.object as { interactionData?: InteractionData }).interactionData ??
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

// Return targetOffset and thetaOffset that would yield the same camera position as the
// given offsets if the target were (0,0,0) and targetOrientation were identity.
function getEquivalentOffsetsWithoutTarget(
  offsets: { readonly targetOffset: Vec3; readonly thetaOffset: number },
  targetPose: { readonly target: Vec3; readonly targetOrientation: Vec4 },
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  followOrientation: boolean = false,
): { targetOffset: Vec3; thetaOffset: number } {
  const heading = followOrientation
    ? (cameraStateSelectors.targetHeading({
        targetOrientation: targetPose.targetOrientation,
      }) as number)
    : 0;
  const targetOffset = vec3.rotateZ([0, 0, 0], offsets.targetOffset, [0, 0, 0], -heading) as [
    number,
    number,
    number,
  ];
  vec3.add(targetOffset, targetOffset, targetPose.target);
  const thetaOffset = offsets.thetaOffset + heading;
  return { targetOffset, thetaOffset };
}

export function getNewCameraStateOnFollowChange({
  prevCameraState,
  prevTargetPose,
  prevFollowTf,
  prevFollowOrientation = false,
  newFollowTf,
  newFollowOrientation = false,
}: {
  prevCameraState: Partial<CameraState>;
  prevTargetPose?: TargetPose;
  prevFollowTf?: string | false;
  prevFollowOrientation?: boolean;
  newFollowTf?: string | false;
  newFollowOrientation?: boolean;
}): Partial<CameraState> {
  const newCameraState = { ...prevCameraState };
  if (typeof newFollowTf === "string" && newFollowTf.length > 0) {
    // When switching to follow orientation, adjust thetaOffset to preserve camera rotation.
    if (newFollowOrientation && !prevFollowOrientation && prevTargetPose) {
      const heading = cameraStateSelectors.targetHeading({
        targetOrientation: prevTargetPose.targetOrientation,
      });
      newCameraState.targetOffset = vec3.rotateZ(
        [0, 0, 0],
        newCameraState.targetOffset ?? DEFAULT_CAMERA_STATE.targetOffset,
        [0, 0, 0],
        heading,
      ) as Vec3;
      newCameraState.thetaOffset =
        (newCameraState.thetaOffset ?? DEFAULT_CAMERA_STATE.thetaOffset) - heading;
    }
    // When following a frame for the first time, snap to the origin.
    if (typeof prevFollowTf !== "string" || prevFollowTf.length === 0) {
      newCameraState.targetOffset = [0, 0, 0];
    }
  } else if (typeof prevFollowTf === "string" && prevFollowTf.length > 0 && prevTargetPose) {
    // When unfollowing, preserve the camera position and orientation.
    Object.assign(
      newCameraState,
      getEquivalentOffsetsWithoutTarget(
        {
          targetOffset: prevCameraState.targetOffset ?? DEFAULT_CAMERA_STATE.targetOffset,
          thetaOffset: prevCameraState.thetaOffset ?? DEFAULT_CAMERA_STATE.thetaOffset,
        },
        prevTargetPose,
        prevFollowOrientation,
      ),
      { target: [0, 0, 0] },
    );
  }

  return newCameraState;
}
