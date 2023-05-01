// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mat4, vec3, quat, ReadonlyMat4, ReadonlyVec3, ReadonlyQuat } from "gl-matrix";

import { Pose, getRotationNoScaling, mat4Identity, quatIdentity, vec3Identity } from "./geometry";

/**
 * Transform represents a position and rotation in 3D space. It can be set and
 * accessed using either Vec3/Quat or Mat4, and these different representations
 * are automatically kept in sync.
 */
export class Transform {
  #position: vec3;
  #rotation: quat;
  #matrix: mat4;

  public constructor(matrixOrPosition: mat4 | vec3, rotation?: quat) {
    if (matrixOrPosition.length === 16) {
      this.#matrix = matrixOrPosition;
      this.#position = [0, 0, 0];
      this.#rotation = [0, 0, 0, 1];
      mat4.getTranslation(this.#position, this.#matrix);
      getRotationNoScaling(this.#rotation, this.#matrix);
    } else if (matrixOrPosition.length === 3 && rotation != undefined) {
      this.#position = matrixOrPosition;
      this.#rotation = rotation;
      quat.normalize(this.#rotation, this.#rotation);
      this.#matrix = mat4.fromRotationTranslation(mat4Identity(), this.#rotation, this.#position);
    } else {
      throw new Error(`new Transform() expected either mat4 or vec3 + quat`);
    }
  }

  public position(): ReadonlyVec3 {
    return this.#position;
  }

  public rotation(): ReadonlyQuat {
    return this.#rotation;
  }

  public matrix(): ReadonlyMat4 {
    return this.#matrix;
  }

  public setPosition(position: ReadonlyVec3): this {
    vec3.copy(this.#position, position);
    mat4.fromRotationTranslation(this.#matrix, this.#rotation, this.#position);
    return this;
  }

  public setRotation(rotation: ReadonlyQuat): this {
    quat.normalize(this.#rotation, rotation);
    mat4.fromRotationTranslation(this.#matrix, this.#rotation, this.#position);
    return this;
  }

  /**
   * Update position and rotation simultaneously. This is more efficient than
   * calling setPosition and setRotation separately, since we only need to
   * update the matrix once
   */
  public setPositionRotation(position: ReadonlyVec3, rotation: ReadonlyQuat): this {
    vec3.copy(this.#position, position);
    quat.normalize(this.#rotation, rotation);
    mat4.fromRotationTranslation(this.#matrix, this.#rotation, this.#position);
    return this;
  }

  /**
   * Update position and rotation from a Pose object
   */
  public setPose(pose: Readonly<Pose>): this {
    vec3.set(this.#position, pose.position.x, pose.position.y, pose.position.z);
    quat.set(
      this.#rotation,
      pose.orientation.x,
      pose.orientation.y,
      pose.orientation.z,
      pose.orientation.w,
    );
    quat.normalize(this.#rotation, this.#rotation);
    mat4.fromRotationTranslation(this.#matrix, this.#rotation, this.#position);
    return this;
  }

  /**
   * Update position and rotation from a matrix with unit scale
   */
  public setMatrixUnscaled(matrix: ReadonlyMat4): this {
    mat4.copy(this.#matrix, matrix);
    mat4.getTranslation(this.#position, matrix);
    getRotationNoScaling(this.#rotation, matrix); // A faster mat4.getRotation when there is no scaling
    return this;
  }

  /**
   * Copy the values in another transform into this one
   */
  public copy(other: Transform): this {
    vec3.copy(this.#position, other.#position);
    quat.copy(this.#rotation, other.#rotation);
    mat4.copy(this.#matrix, other.#matrix);
    return this;
  }

  public toPose(out: Pose): void {
    out.position.x = this.#position[0];
    out.position.y = this.#position[1];
    out.position.z = this.#position[2];
    out.orientation.x = this.#rotation[0];
    out.orientation.y = this.#rotation[1];
    out.orientation.z = this.#rotation[2];
    out.orientation.w = this.#rotation[3];
  }

  public static Identity(): Transform {
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
  public static Interpolate(out: Transform, a: Transform, b: Transform, t: number): Transform {
    vec3.lerp(out.#position, a.position(), b.position(), t);
    quat.slerp(out.#rotation, a.rotation(), b.rotation(), t);
    out.setPositionRotation(out.#position, out.#rotation);
    return out;
  }
}
