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

import { mat4, vec3, quat, vec4 } from "gl-matrix";

import { TF, MutablePose, Pose, Point, Orientation } from "@foxglove/studio-base/types/Messages";

// allocate some temporary variables
// so we can copy/in out of them during tf application
// this reduces GC as this code gets called lot
const tempMat: mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const tempPos: vec3 = [0, 0, 0];
const tempScale: vec3 = [0, 0, 0];
const tempOrient: vec4 = [0, 0, 0, 0];

function stripLeadingSlash(name: string) {
  return name.startsWith("/") ? name.slice(1) : name;
}

// REP 105 specifies a set of conventional root frame transform ids
// https://www.ros.org/reps/rep-0105.html
export const DEFAULT_ROOT_FRAME_IDS = ["base_link", "odom", "map", "earth"];

export class Transform {
  id: string;
  matrix: mat4 = mat4.create();
  parent?: Transform;
  private _hasValidMatrix: boolean = false;

  constructor(id: string) {
    this.id = stripLeadingSlash(id);
  }

  set(position: Point, orientation: Orientation): void {
    mat4.fromRotationTranslation(
      this.matrix,
      quat.set(tempOrient, orientation.x, orientation.y, orientation.z, orientation.w),
      vec3.set(tempPos, position.x, position.y, position.z),
    );
    this._hasValidMatrix = true;
  }

  isValid(rootId: string): boolean {
    return this._hasValidMatrix || this.id === rootId;
  }

  isChildOfTransform(unsanitizedRootId: string): boolean {
    const rootId = stripLeadingSlash(unsanitizedRootId);
    if (!this.parent) {
      return this.id === rootId;
    }
    return this.parent.isChildOfTransform(rootId);
  }

  rootTransform(): Transform {
    if (!this.parent) {
      return this;
    }
    return this.parent.rootTransform();
  }

  apply(output: MutablePose, input: Pose, unsanitizedRootId: string): MutablePose | undefined {
    const rootId = stripLeadingSlash(unsanitizedRootId);
    if (!this.isValid(rootId)) {
      return undefined;
    }

    if (this.id === rootId) {
      output.position.x = input.position.x;
      output.position.y = input.position.y;
      output.position.z = input.position.z;
      output.orientation.x = input.orientation.x;
      output.orientation.y = input.orientation.y;
      output.orientation.z = input.orientation.z;
      output.orientation.w = input.orientation.w;
      return output;
    }

    // Can't apply if this transform doesn't map to the root transform.
    if (!this.isChildOfTransform(rootId)) {
      return undefined;
    }

    const { position, orientation } = input;
    // set a transform matrix from the input pose
    mat4.fromRotationTranslation(
      tempMat,
      quat.set(tempOrient, orientation.x, orientation.y, orientation.z, orientation.w),
      vec3.set(tempPos, position.x, position.y, position.z),
    );

    // set transform matrix to (our matrix * pose transform matrix)
    mat4.multiply(tempMat, this.matrix, tempMat);

    // copy the transform matrix components out into temp variables
    mat4.getTranslation(tempPos, tempMat);

    // Normalize the values in the matrix by the scale. This ensures that we get the correct rotation
    // out even if the scale isn't 1 in each axis. The logic from this comes from the threejs
    // implementation and an SO answer:
    // - https://github.com/mrdoob/three.js/blob/master/src/math/Matrix4.js#L790-L815
    // - https://math.stackexchange.com/a/1463487
    mat4.getScaling(tempScale, tempMat);
    if (mat4.determinant(tempMat) < 0) {
      tempScale[0] *= -1;
    }
    vec3.inverse(tempScale, tempScale);
    mat4.scale(tempMat, tempMat, tempScale);

    mat4.getRotation(tempOrient, tempMat);

    // mutate the output w/ the temp values
    output.position.x = tempPos[0];
    output.position.y = tempPos[1];
    output.position.z = tempPos[2];
    output.orientation.x = tempOrient[0];
    output.orientation.y = tempOrient[1];
    output.orientation.z = tempOrient[2];
    output.orientation.w = tempOrient[3];

    if (!this.parent) {
      return output;
    }
    return this.parent.apply(output, output, rootId);
  }
}

class TfStore {
  private _storage = new Map<string, Transform>();

  get(unsanitizedKey: string): Transform {
    const key = stripLeadingSlash(unsanitizedKey);
    let result = this._storage.get(key);
    if (result) {
      return result;
    }
    result = new Transform(key);
    this._storage.set(key, result);
    return result;
  }

  getMaybe(key: string): Transform | undefined {
    return this._storage.get(stripLeadingSlash(key));
  }

  has(key: string): boolean {
    return this._storage.has(stripLeadingSlash(key));
  }

  values(): Array<Transform> {
    return Array.from(this._storage.values());
  }

  entries(): Readonly<Map<string, Transform>> {
    return this._storage;
  }
}

export default class Transforms {
  storage = new TfStore();
  empty = true;

  // consume a tf message
  consume(tfMessage: TF): void {
    // child_frame_id is the id of the tf
    const id = tfMessage.child_frame_id;
    const parentId = tfMessage.header.frame_id;
    this.register(parentId);
    const tf = this.storage.get(id);
    const { rotation, translation } = tfMessage.transform;
    tf.set(translation, rotation);
    tf.parent = this.storage.get(parentId);
    this.empty = false;
  }

  // create a placeholder tf if we have not seen this frameId yet
  register(frameId: string): void {
    this.storage.get(frameId);
    this.empty = false;
  }

  // Apply the tf hierarchy to the original pose and update the pose supplied in the output parameter.
  // This follows the same calling conventions in the gl-mat4 lib, which takes an 'out' parameter as their first argument.
  // This allows the caller to decide if they want to update the pose by reference
  // (by reference by supplying it as both the first and second arguments)
  // or return a new one by calling with apply({ position: { }, orientation: {} }, original).
  // Returns the output pose, or the input pose if no transform was needed, or undefined if the transform
  // is not available -- the return value must not be ignored.
  apply(
    output: MutablePose,
    original: Pose,
    frameId: string,
    rootId: string,
  ): MutablePose | undefined {
    const tf = this.storage.getMaybe(frameId);
    return tf?.apply(output, original, rootId);
  }

  rootOfTransform(transformID: string): Transform {
    return this.get(transformID).rootTransform();
  }

  // Return true if a transform with id _key_ exists in our transforms
  has(key: string): boolean {
    return this.storage.has(key);
  }

  get(key: string): Transform {
    return this.storage.get(key);
  }

  getMaybe(key: string): Transform | undefined {
    return this.storage.getMaybe(key);
  }

  values(): Array<Transform> {
    return this.storage.values();
  }
}
