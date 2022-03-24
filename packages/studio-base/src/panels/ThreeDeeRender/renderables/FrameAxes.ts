// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import Logger from "@foxglove/log";

import { Renderer } from "../Renderer";
import { Pose, rosTimeToNanoSec, TF } from "../ros";
import { Transform } from "../transforms/Transform";
import { makePose } from "../transforms/geometry";
import { updatePose } from "../updatePose";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

const log = Logger.getLogger(__filename);

type FrameAxisRenderable = THREE.Object3D & {
  userData: {
    frameId?: string;
    pose?: Pose;
  };
};

export class FrameAxes extends THREE.Object3D {
  renderer: Renderer;
  axesByFrameId = new Map<string, FrameAxisRenderable>();

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;
  }

  dispose(): void {
    for (const axisRenderable of this.axesByFrameId.values()) {
      axisRenderable.traverse((obj) => {
        if (obj instanceof THREE.AxesHelper) {
          obj.dispose();
        }
      });
    }
    this.children.length = 0;
    this.axesByFrameId.clear();
  }

  addTransformMessage(tf: TF): void {
    let frameAdded = false;
    if (!this.renderer.transformTree.hasFrame(tf.header.frame_id)) {
      this._addFrameAxis(tf.header.frame_id);
      frameAdded = true;
    }
    if (!this.renderer.transformTree.hasFrame(tf.child_frame_id)) {
      this._addFrameAxis(tf.child_frame_id);
      frameAdded = true;
    }

    const stamp = rosTimeToNanoSec(tf.header.stamp);
    const t = tf.transform.translation;
    const q = tf.transform.rotation;
    const transform = new Transform([t.x, t.y, t.z], [q.x, q.y, q.z, q.w]);
    this.renderer.transformTree.addTransform(
      tf.child_frame_id,
      tf.header.frame_id,
      stamp,
      transform,
    );

    if (frameAdded) {
      log.debug(`Added transform "${tf.header.frame_id}_T_${tf.child_frame_id}"`);
      this.renderer.emit("transformTreeUpdated", this.renderer);
    }
  }

  startFrame(currentTime: bigint): void {
    const renderFrameId = this.renderer.renderFrameId;
    const fixedFrameId = this.renderer.fixedFrameId;
    if (!renderFrameId || !fixedFrameId) {
      return;
    }

    for (const [frameId, renderable] of this.axesByFrameId.entries()) {
      const updated = updatePose(
        renderable,
        this.renderer.transformTree,
        renderFrameId,
        fixedFrameId,
        frameId,
        currentTime,
        currentTime,
      );
      if (!updated) {
        const message = missingTransformMessage(renderFrameId, fixedFrameId, frameId);
        this.renderer.layerErrors.addToLayer(`f:${frameId}`, MISSING_TRANSFORM, message);
      }
    }
  }

  private _addFrameAxis(frameId: string): void {
    if (this.axesByFrameId.has(frameId)) {
      return;
    }

    const frame = new THREE.Object3D() as FrameAxisRenderable;
    frame.name = frameId;
    frame.userData.frameId = frameId;
    frame.userData.pose = makePose();

    const AXIS_DEFAULT_LENGTH = 1; // [m]
    const axes = new THREE.AxesHelper(AXIS_DEFAULT_LENGTH);
    frame.add(axes);

    // TODO: <div> floating label

    this.add(frame);
    this.axesByFrameId.set(frameId, frame);
  }
}
