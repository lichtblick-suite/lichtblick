// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mat4, vec3, quat, ReadonlyMat4, ReadonlyVec3, ReadonlyQuat } from "gl-matrix";

import { MutablePose, Pose } from "@foxglove/studio-base/types/Messages";

import { mat4Identity, quatIdentity, vec3Identity } from "./geometry";

const tempMat = mat4Identity();
const tempScale = vec3Identity();

/**
 * Transform represents a position and rotation in 3D space. It can be set and
 * accessed using either Vec3/Quat or Mat4, and these different representations
 * are automatically kept in sync.
 */
export class Transform {
  private _position: vec3;
  private _rotation: quat;
  private _matrix: mat4;

  constructor(position: vec3, rotation: quat) {
    this._position = position;
    this._rotation = rotation;
    this._matrix = mat4.fromRotationTranslation(mat4Identity(), this._rotation, this._position);
  }

  position(): ReadonlyVec3 {
    return this._position;
  }

  rotation(): ReadonlyQuat {
    return this._rotation;
  }

  matrix(): ReadonlyMat4 {
    return this._matrix;
  }

  setPosition(position: ReadonlyVec3): this {
    vec3.copy(this._position, position);
    mat4.fromRotationTranslation(this._matrix, this._rotation, this._position);
    return this;
  }

  setRotation(rotation: ReadonlyQuat): this {
    quat.copy(this._rotation, rotation);
    mat4.fromRotationTranslation(this._matrix, this._rotation, this._position);
    return this;
  }

  /**
   * Update position and rotation simultaneously. This is more efficient than
   * calling setPosition and setRotation separately, since we only need to
   * update the matrix once
   */
  setPositionRotation(position: ReadonlyVec3, rotation: ReadonlyQuat): this {
    vec3.copy(this._position, position);
    quat.copy(this._rotation, rotation);
    mat4.fromRotationTranslation(this._matrix, this._rotation, this._position);
    return this;
  }

  /**
   * Update position and rotation from a Pose object
   */
  setPose(pose: Pose): this {
    vec3.set(this._position, pose.position.x, pose.position.y, pose.position.z);
    quat.set(
      this._rotation,
      pose.orientation.x,
      pose.orientation.y,
      pose.orientation.z,
      pose.orientation.w,
    );
    mat4.fromRotationTranslation(this._matrix, this._rotation, this._position);
    return this;
  }

  /**
   * Update position and rotation from a matrix
   */
  setMatrix(matrix: ReadonlyMat4): this {
    mat4.copy(this._matrix, matrix);
    mat4.getTranslation(this._position, matrix);

    // Normalize the values in the matrix by the scale. This ensures that we get the correct rotation
    // out even if the scale isn't 1 in each axis. The logic from this comes from the threejs
    // implementation and an SO answer:
    // - https://github.com/mrdoob/three.js/blob/master/src/math/Matrix4.js#L790-L815
    // - https://math.stackexchange.com/a/1463487
    mat4.getScaling(tempScale, matrix);
    if (mat4.determinant(matrix) < 0) {
      tempScale[0] *= -1;
    }
    vec3.inverse(tempScale, tempScale);
    mat4.scale(tempMat, matrix, tempScale);

    mat4.getRotation(this._rotation, tempMat);
    return this;
  }

  /**
   * Copy the values in another transform into this one
   */
  copy(other: Transform): this {
    // eslint-disable-next-line no-underscore-dangle
    vec3.copy(this._position, other._position);
    // eslint-disable-next-line no-underscore-dangle
    quat.copy(this._rotation, other._rotation);
    // eslint-disable-next-line no-underscore-dangle
    mat4.copy(this._matrix, other._matrix);
    return this;
  }

  toPose(out: MutablePose): void {
    out.position.x = this._position[0];
    out.position.y = this._position[1];
    out.position.z = this._position[2];
    out.orientation.x = this._rotation[0];
    out.orientation.y = this._rotation[1];
    out.orientation.z = this._rotation[2];
    out.orientation.w = this._rotation[3];
  }

  static Identity(): Transform {
    return new Transform(vec3Identity(), quatIdentity());
  }

  /**
   * Interpolate between two rigid body transforms using linear interpolation on
   * the translation vector and spherical linear interpolation on the rotation
   * quaternion.
   *
   * @param out Output transform to store the result in
   * @param a Start transform
   * @param b End transform
   * @param t Interpolant in the range [0, 1]
   * @returns A reference to `out`
   */
  static Interpolate(out: Transform, a: Transform, b: Transform, t: number): Transform {
    // eslint-disable-next-line no-underscore-dangle
    vec3.lerp(out._position, a.position(), b.position(), t);
    // eslint-disable-next-line no-underscore-dangle
    quat.slerp(out._rotation, a.rotation(), b.rotation(), t);
    // eslint-disable-next-line no-underscore-dangle
    out.setPositionRotation(out._position, out._rotation);
    return out;
  }
}
