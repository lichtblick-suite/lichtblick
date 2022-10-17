// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable no-underscore-dangle */
/* eslint-disable @foxglove/no-boolean-parameters */

import { mat4, quat, vec3, vec4 } from "gl-matrix";

import { ArrayMap } from "@foxglove/den/collection";

import { Transform } from "./Transform";
import { Pose, mat4Identity } from "./geometry";
import { Duration, interpolate, percentOf, Time } from "./time";

type TimeAndTransform = [time: Time, transform: Transform];

export const MAX_DURATION: Duration = 4_294_967_295n * BigInt(1e9);

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const tempLower: TimeAndTransform = [0n, Transform.Identity()];
const tempUpper: TimeAndTransform = [0n, Transform.Identity()];
const tempVec3: vec3 = [0, 0, 0];
const tempVec4: vec4 = [0, 0, 0, 0];
const tempTransform = Transform.Identity();
const tempMatrix = mat4Identity();
const temp2Matrix = mat4Identity();

/**
 * CoordinateFrame is a named 3D coordinate frame with an optional parent frame
 * and a history of transforms from this frame to its parent. The parent/child
 * hierarchy and transform history allow points to be transformed from one
 * coordinate frame to another while interpolating over time.
 */
// ts-prune-ignore-next
export class CoordinateFrame {
  public readonly id: string;
  public maxStorageTime: Duration;
  public maxCapacity: number;
  public offsetPosition: vec3 | undefined;
  public offsetEulerDegrees: vec3 | undefined;

  private _parent?: CoordinateFrame;
  private _transforms: ArrayMap<Time, Transform>;

  public constructor(
    id: string,
    parent: CoordinateFrame | undefined,
    maxStorageTime: Duration,
    maxCapacity: number,
  ) {
    this.id = id;
    this.maxStorageTime = maxStorageTime;
    this.maxCapacity = maxCapacity;
    this._parent = parent;
    this._transforms = new ArrayMap<Time, Transform>();
  }

  public parent(): CoordinateFrame | undefined {
    return this._parent;
  }

  /**
   * Returns the top-most frame by walking up each parent frame. If the current
   * frame does not have a parent, the current frame is returned.
   */
  public root(): CoordinateFrame {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let root: CoordinateFrame = this;
    while (root._parent) {
      root = root._parent;
    }
    return root;
  }

  /**
   * Returns true if this frame has no parent frame.
   */
  public isRoot(): boolean {
    return this._parent == undefined;
  }

  /**
   * Returns the number of transforms stored in the transform history.
   */
  public transformsSize(): number {
    return this._transforms.size;
  }

  /**
   * Set the parent frame for this frame. If the parent frame is already set to
   * a different frame, the transform history is cleared.
   */
  public setParent(parent: CoordinateFrame): void {
    if (this._parent && this._parent !== parent) {
      this._transforms.clear();
    }
    this._parent = parent;
  }

  /**
   * Search for an ancestor frame with the given ID by walking up the chain of
   * parent frames, starting at the current frame.
   * @param id Frame ID to search for
   * @returns The ancestor frame, or undefined if not found
   */
  public findAncestor(id: string): CoordinateFrame | undefined {
    let ancestor: CoordinateFrame | undefined = this._parent;
    while (ancestor) {
      if (ancestor.id === id) {
        return ancestor;
      }
      ancestor = ancestor._parent;
    }
    return undefined;
  }

  /**
   * Add a transform to the transform history maintained by this frame. The
   * difference between the newest and oldest timestamps cannot be more than
   * `this.maxStorageTime`, so this addition may purge older transforms.
   *
   * If a transform with an identical timestamp already exists, it is replaced.
   */
  public addTransform(time: Time, transform: Transform): void {
    this._transforms.set(time, transform);

    // Remove transforms that are too old
    const endTime = this._transforms.maxKey()!;
    const startTime = endTime - this.maxStorageTime;
    while (this._transforms.size > 1 && this._transforms.minKey()! < startTime) {
      this._transforms.shift();
    }

    // Trim down to the maximum history size
    while (this._transforms.size > this.maxCapacity) {
      this._transforms.shift();
    }
  }

  /** Remove all transforms with timestamps greater than the given timestamp. */
  public removeTransformsAfter(time: Time): void {
    this._transforms.removeAfter(time);
  }

  /**
   * Find the closest transform(s) in the transform history to the given time.
   * Note that if an exact match is found, both `outLower` and `outUpper` will
   * be set to the same transform.
   * @param outLower This will be set to the found transform with the closest
   *   timestamp <= the given time
   * @param outUpper This will be set to the found transform with the closest
   *   timestamp >= the given time
   * @param time Time to search for
   * @param maxDelta The time parameter can exceed the bounds of the transform
   *   history by up to this amount and still clamp to the oldest or newest
   *   transform
   * @returns True if the search was successful
   */
  public findClosestTransforms(
    outLower: TimeAndTransform,
    outUpper: TimeAndTransform,
    time: Time,
    maxDelta: Duration,
  ): boolean {
    // perf-sensitive: function params instead of options object to avoid allocations
    const transformCount = this._transforms.size;
    if (transformCount === 0) {
      return false;
    } else if (transformCount === 1) {
      // If only a single transform exists, check if `time` is before or equal to
      // `latestTime + maxDelta`
      const [latestTime, latestTf] = this._transforms.maxEntry()!;
      if (time <= latestTime + maxDelta) {
        outLower[0] = outUpper[0] = latestTime;
        outLower[1] = outUpper[1] = latestTf;
        return true;
      }
      return false;
    }

    const index = this._transforms.binarySearch(time);
    if (index >= 0) {
      // If the time is exactly on an existing transform, return it
      const [_, tf] = this._transforms.at(index)!;
      outLower[0] = outUpper[0] = time;
      outLower[1] = outUpper[1] = tf;
      return true;
    }

    const greaterThanIndex = ~index;
    if (greaterThanIndex >= this._transforms.size) {
      // If the time is greater than all existing transforms, return the last
      // transform
      const [latestTime, latestTf] = this._transforms.maxEntry()!;
      if (time <= latestTime + maxDelta) {
        outLower[0] = outUpper[0] = latestTime;
        outLower[1] = outUpper[1] = latestTf;
        return true;
      }
      return false;
    }

    const lessThanIndex = greaterThanIndex - 1;
    if (lessThanIndex < 0) {
      // If the time is less than all existing transforms, return the first
      // transform
      const [earliestTime, earliestTf] = this._transforms.minEntry()!;
      if (earliestTime + maxDelta >= time) {
        outLower[0] = outUpper[0] = earliestTime;
        outLower[1] = outUpper[1] = earliestTf;
        return true;
      }
      return false;
    }

    const [lteTime, lteTf] = this._transforms.at(lessThanIndex)!;
    const [gtTime, gtTf] = this._transforms.at(greaterThanIndex)!;
    outLower[0] = lteTime;
    outLower[1] = lteTf;
    outUpper[0] = gtTime;
    outUpper[1] = gtTf;
    return true;
  }

  /**
   * Transform a pose from the coordinate frame `srcFrame` to this coordinate
   * frame at the given time. The transform will be done using the shortest path
   * from `srcFrame` to this frame
   *
   * Transforms can go up through multiple parents, down through one or more
   * children, or both as long as the transforms share a common ancestor.
   *
   * A common variable naming convention for the returned pose is
   * `thisFrame_T_srcFrame` which is read right-to-left as "the translation that
   * moves a point from `srcFrame` to `thisFrame`".
   * @param out Output pose, this will be modified with the result on success
   * @param input Input pose that exists in `srcFrame`
   * @param srcFrame Coordinate frame we are transforming from
   * @param time Time to compute the transform at
   * @param maxDelta The time parameter can exceed the bounds of the transform
   *   history by up to this amount and still clamp to the oldest or newest
   *   transform
   * @returns A reference to `out` on success, otherwise undefined
   */
  public applyLocal(
    out: Pose,
    input: Readonly<Pose>,
    srcFrame: CoordinateFrame,
    time: Time,
    maxDelta: Duration = MAX_DURATION,
  ): Pose | undefined {
    // perf-sensitive: function params instead of options object to avoid allocations
    if (srcFrame === this) {
      // Identity transform
      copyPose(out, input);
      return out;
    } else if (srcFrame.findAncestor(this.id)) {
      // This frame is an ancestor of the source frame
      return CoordinateFrame.Apply(out, input, this, srcFrame, false, time, maxDelta)
        ? out
        : undefined;
    } else if (this.findAncestor(srcFrame.id)) {
      // This frame is a descendant of the source frame
      return CoordinateFrame.Apply(out, input, srcFrame, this, true, time, maxDelta)
        ? out
        : undefined;
    }

    // Check if the two frames share a common ancestor
    let curSrcFrame: CoordinateFrame | undefined = srcFrame;
    while (curSrcFrame) {
      const commonAncestor = this.findAncestor(curSrcFrame.id);
      if (commonAncestor) {
        // Common ancestor found. Apply transforms from the source frame to the common ancestor,
        // then apply transforms from the common ancestor to this frame
        if (!CoordinateFrame.Apply(out, input, commonAncestor, srcFrame, false, time, maxDelta)) {
          return undefined;
        }
        return CoordinateFrame.Apply(out, out, commonAncestor, this, true, time, maxDelta)
          ? out
          : undefined;
      }
      curSrcFrame = curSrcFrame._parent;
    }

    return undefined;
  }

  /**
   * Transform a pose from the coordinate frame `srcFrame` to rootFrame at
   * `srcTime`, then from `rootFrame` to this coordinate frame at `dstTime`. The
   * transform will be done using the shortest path from `srcFrame` to the root
   * frame, then from the root frame to this frame.
   *
   * Transforms can go up through multiple parents, down through one or more
   * children, or both as long as the transforms share a common ancestor.
   * @param out Output pose, this will be modified with the result on success
   * @param input Input pose that exists in `srcFrame`
   * @param rootFrame Reference coordinate frame to transform from srcFrame into as srcTime
   * @param srcFrame Coordinate frame we are transforming from
   * @param dstTime Time to transform from rootFrome into this frame
   * @param srcTime Time to transform from srcFrame into rootFrame
   * @param maxDelta The time parameter can exceed the bounds of the transform
   *   history by up to this amount and still clamp to the oldest or newest
   *   transform
   * @returns A reference to `out` on success, otherwise undefined
   */
  public apply(
    out: Pose,
    input: Readonly<Pose>,
    rootFrame: CoordinateFrame,
    srcFrame: CoordinateFrame,
    dstTime: Time,
    srcTime: Time,
    maxDelta: Duration = MAX_DURATION,
  ): Pose | undefined {
    // perf-sensitive: function params instead of options object to avoid allocations

    // Transform from the source frame to the root frame
    if (rootFrame.applyLocal(out, input, srcFrame, srcTime, maxDelta) == undefined) {
      return undefined;
    }
    // Transform from the root frame to this frame
    return this.applyLocal(out, out, rootFrame, dstTime, maxDelta);
  }

  /**
   * Returns a display-friendly rendition of `id`, quoting the frame id if it is
   * an empty string or starts or ends with whitespace.
   */
  public displayName(): string {
    return CoordinateFrame.DisplayName(this.id);
  }

  /**
   * Interpolate between two [time, transform] pairs.
   * @param output Output parameter for the interpolated time and transform
   * @param lower Start [time, transform]
   * @param upper End [time, transform]
   * @param time Interpolant in the range [lower[0], upper[0]]
   */
  public static Interpolate(
    output: TimeAndTransform,
    lower: TimeAndTransform,
    upper: TimeAndTransform,
    time: Time,
  ): void {
    // perf-sensitive: function params instead of options object to avoid allocations
    const [lowerTime, lowerTf] = lower;
    const [upperTime, upperTf] = upper;

    if (lowerTime === upperTime) {
      output[0] = upperTime;
      output[1].copy(upperTf);
      return;
    }

    // Interpolate times and transforms
    const fraction = Math.max(0, Math.min(1, percentOf(lowerTime, upperTime, time)));
    output[0] = interpolate(lowerTime, upperTime, fraction);
    Transform.Interpolate(output[1], lowerTf, upperTf, fraction);
  }

  /**
   * Interpolate the transform between two [time, transform] pairs.
   * @param output Output parameter for the interpolated transform
   * @param lower Start [time, transform]
   * @param upper End [time, transform]
   * @param time Interpolant in the range [lower[0], upper[0]]
   */
  public static InterpolateTransform(
    output: Transform,
    lower: TimeAndTransform,
    upper: TimeAndTransform,
    time: Time,
  ): void {
    // perf-sensitive: function params instead of options object to avoid allocations
    const [lowerTime, lowerTf] = lower;
    const [upperTime, upperTf] = upper;

    if (lowerTime === upperTime) {
      output.copy(upperTf);
      return;
    }

    // Interpolate times and transforms
    const fraction = Math.max(0, Math.min(1, percentOf(lowerTime, upperTime, time)));
    Transform.Interpolate(output, lowerTf, upperTf, fraction);
  }

  /**
   * Get the transform `parentFrame_T_childFrame` (from child to parent) at the
   * given time.
   * @param out Output transform matrix
   * @param parentFrame Parent destination frame
   * @param childFrame Child source frame
   * @param time Time to transform at
   * @param maxDelta The time parameter can exceed the bounds of the transform
   *   history by up to this amount and still clamp to the oldest or newest
   *   transform
   * @returns True on success
   */
  public static GetTransformMatrix(
    out: mat4,
    parentFrame: CoordinateFrame,
    childFrame: CoordinateFrame,
    time: Time,
    maxDelta: Duration,
  ): boolean {
    // perf-sensitive: function params instead of options object to avoid allocations
    mat4.identity(out);

    let curFrame = childFrame;
    while (curFrame !== parentFrame) {
      if (!curFrame.findClosestTransforms(tempLower, tempUpper, time, maxDelta)) {
        return false;
      }
      CoordinateFrame.InterpolateTransform(tempTransform, tempLower, tempUpper, time);

      if (curFrame.offsetEulerDegrees) {
        const quaternion = tempTransform.rotation();
        const rotationMatrix = mat4.fromQuat(temp2Matrix, quaternion);
        const euler = eulerFromMatrixUnscaled(tempVec3, rotationMatrix);
        vec3.add(euler, euler, curFrame.offsetEulerDegrees);
        tempTransform.setRotation(quaternionFromEuler(tempVec4, euler));
      }

      if (curFrame.offsetPosition) {
        const p = tempTransform.position() as vec3;
        vec3.add(p, p, curFrame.offsetPosition);
        tempTransform.setPosition(p);
      }

      mat4.multiply(out, tempTransform.matrix(), out);

      if (curFrame._parent == undefined) {
        throw new Error(`Frame "${parentFrame.id}" is not a parent of "${childFrame.id}"`);
      }
      curFrame = curFrame._parent;
    }

    return true;
  }

  /**
   * Apply the transform from `child` to `parent` at the given time to the given
   * input pose. The transform can optionally be inverted, to go from `parent`
   * to `child`.
   * @param out Output pose, this will be modified with the result on success
   * @param input Input pose that exists in `child`, or `parent` if `invert` is
   *   true
   * @param parent Parent frame
   * @param child Child frame
   * @invert Whether to invert the transform (go from parent to child)
   * @param time Time to compute the transform at
   * @param maxDelta The time parameter can exceed the bounds of the transform
   *   history by up to this amount and still clamp to the oldest or newest
   *   transform
   * @returns True on success
   */
  public static Apply(
    out: Pose,
    input: Readonly<Pose>,
    parent: CoordinateFrame,
    child: CoordinateFrame,
    invert: boolean,
    time: Time,
    maxDelta: Duration,
  ): boolean {
    // perf-sensitive: function params instead of options object to avoid allocations
    if (!CoordinateFrame.GetTransformMatrix(tempMatrix, parent, child, time, maxDelta)) {
      return false;
    }
    if (invert) {
      mat4.invert(tempMatrix, tempMatrix);
    }

    mat4.multiply(tempMatrix, tempMatrix, tempTransform.setPose(input).matrix());
    tempTransform.setMatrixUnscaled(tempMatrix).toPose(out);
    return true;
  }

  /**
   * Returns a display-friendly rendition of `frameId`, quoting the id if it is
   * an empty string or starts or ends with whitespace.
   */
  public static DisplayName(frameId: string): string {
    return frameId === "" || frameId.startsWith(" ") || frameId.endsWith(" ")
      ? `"${frameId}"`
      : frameId;
  }
}

function copyPose(out: Pose, pose: Readonly<Pose>): void {
  const p = pose.position;
  const o = pose.orientation;
  out.position.x = p.x;
  out.position.y = p.y;
  out.position.z = p.z;
  out.orientation.x = o.x;
  out.orientation.y = o.y;
  out.orientation.z = o.z;
  out.orientation.w = o.w;
}

// Compute XYZ Euler angles in degrees from an unscaled rotation matrix. This
// method is adapted from THREE.js Euler#setFromRotationMatrix()
function eulerFromMatrixUnscaled(out: vec3, m: mat4): vec3 {
  const m11 = m[0];
  const m12 = m[4];
  const m13 = m[8];
  const m22 = m[5];
  const m23 = m[9];
  const m32 = m[6];
  const m33 = m[10];

  out[1] = Math.asin(Math.max(-1, Math.min(1, m13)));

  if (Math.abs(m13) < 0.9999999) {
    out[0] = Math.atan2(-m23, m33);
    out[2] = Math.atan2(-m12, m11);
  } else {
    out[0] = Math.atan2(m32, m22);
    out[2] = 0;
  }

  // Convert to degrees
  out[0] *= RAD2DEG;
  out[1] *= RAD2DEG;
  out[2] *= RAD2DEG;
  return out;
}

// Compute a quaternion from XYZ Euler angles in degrees. This method is adapted
// from THREE.js Quaternionr#setFromEuler()
function quaternionFromEuler(out: quat, euler: vec3): quat {
  const x = euler[0] * DEG2RAD;
  const y = euler[1] * DEG2RAD;
  const z = euler[2] * DEG2RAD;

  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);

  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);

  out[0] = s1 * c2 * c3 + c1 * s2 * s3;
  out[1] = c1 * s2 * c3 - s1 * c2 * s3;
  out[2] = c1 * c2 * s3 + s1 * s2 * c3;
  out[3] = c1 * c2 * c3 - s1 * s2 * s3;
  return out;
}
