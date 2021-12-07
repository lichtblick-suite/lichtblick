// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Duration, Time } from "@foxglove/rostime";
import { MutablePose, Pose, TF } from "@foxglove/studio-base/types/Messages";

import { CoordinateFrame } from "./CoordinateFrame";
import { Transform } from "./Transform";
import { quatFromValues, vec3FromValues } from "./geometry";

/**
 * TransformTree is a collection of coordinate frames with convenience methods
 * for getting and creating frames and adding transforms between frames.
 */
export class TransformTree {
  private _frames = new Map<string, CoordinateFrame>();

  addTransform(frameId: string, parentFrameId: string, time: Time, transform: Transform): void {
    const frame = this.getOrCreateFrame(frameId);
    const curParentFrame = frame.parent();
    if (curParentFrame == undefined || curParentFrame.id !== parentFrameId) {
      // This frame was previously unparented but now we know its parent, or we
      // are reparenting this frame
      frame.setParent(this.getOrCreateFrame(parentFrameId));
    }

    frame.addTransform(time, transform);
  }

  addTransformMessage(tf: TF): void {
    const t = tf.transform.translation;
    const q = tf.transform.rotation;
    const transform = new Transform(
      vec3FromValues(t.x, t.y, t.z),
      quatFromValues(q.x, q.y, q.z, q.w),
    );
    this.addTransform(tf.child_frame_id, tf.header.frame_id, tf.header.stamp, transform);
  }

  hasFrame(id: string): boolean {
    return this._frames.has(id);
  }

  frame(id: string): CoordinateFrame | undefined {
    return this._frames.get(id);
  }

  getOrCreateFrame(id: string): CoordinateFrame {
    let frame = this._frames.get(id);
    if (!frame) {
      frame = new CoordinateFrame(id, undefined);
      this._frames.set(id, frame);
    }
    return frame;
  }

  frames(): ReadonlyMap<string, CoordinateFrame> {
    return this._frames;
  }

  apply(
    output: MutablePose,
    original: Pose,
    frameId: string,
    srcFrameId: string,
    time: Time,
    maxDelta?: Duration,
  ): MutablePose | undefined {
    const frame = this.frame(frameId);
    const srcFrame = this.frame(srcFrameId);
    return frame && srcFrame ? frame.apply(output, original, srcFrame, time, maxDelta) : undefined;
  }

  static Clone(tree: TransformTree): TransformTree {
    const newTree = new TransformTree();
    // eslint-disable-next-line no-underscore-dangle
    newTree._frames = tree._frames;
    return newTree;
  }
}
