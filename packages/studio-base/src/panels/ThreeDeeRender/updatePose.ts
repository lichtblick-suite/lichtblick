// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { TransformTree, makePose, Pose, AnyFrameId } from "./transforms";

const tempPose = makePose();

export function updatePose(
  renderable: THREE.Object3D,
  transformTree: TransformTree,
  renderFrameId: AnyFrameId,
  fixedFrameId: AnyFrameId,
  srcFrameId: string,
  dstTime: bigint,
  srcTime: bigint,
): boolean {
  const pose = renderable.userData.pose as Readonly<Pose> | undefined;
  if (!pose) {
    throw new Error(`Missing userData.pose for ${renderable.name}`);
  }
  const poseApplied = Boolean(
    transformTree.apply(tempPose, pose, renderFrameId, fixedFrameId, srcFrameId, dstTime, srcTime),
  );
  renderable.visible = poseApplied;
  if (poseApplied) {
    const p = tempPose.position;
    const q = tempPose.orientation;
    renderable.position.set(p.x, p.y, p.z);
    renderable.quaternion.set(q.x, q.y, q.z, q.w);
  }
  return poseApplied;
}
