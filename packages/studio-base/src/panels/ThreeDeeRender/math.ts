// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

const UNIT_X = new THREE.Vector3(1, 0, 0);
const UNIT_Y = new THREE.Vector3(0, 1, 0);

const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const c = new THREE.Vector3();

export function getRotationTo(src: THREE.Vector3, dest: THREE.Vector3): THREE.Quaternion {
  // Adapted from <https://www.ogre3d.org/docs/api/1.8/_ogre_vector3_8h_source.html>
  // Based on Stan Melax's article in Game Programming Gems
  const q = new THREE.Quaternion(0, 0, 0, 1);
  v0.copy(src).normalize();
  v1.copy(dest).normalize();

  const d = v0.dot(v1);
  // If dot == 1, vectors are the same
  if (d >= 1.0) {
    return q;
  }
  if (d < 1e-6 - 1.0) {
    // Generate an axis
    let axis = c.copy(UNIT_X).cross(src);
    if (isZeroLength(axis)) {
      // Pick another if collinear
      axis = c.copy(UNIT_Y).cross(src);
    }
    axis.normalize();
    q.setFromAxisAngle(axis, Math.PI);
  } else {
    const s = Math.sqrt((1 + d) * 2);
    const invs = 1 / s;

    c.copy(v0).cross(v1);

    q.x = c.x * invs;
    q.y = c.y * invs;
    q.z = c.z * invs;
    q.w = s * 0.5;
    q.normalize();
  }
  return q;
}

export function isZeroLength(vec: THREE.Vector3): boolean {
  return vec.lengthSq() < 1e-6 * 1e-6;
}

export function approxEquals(a: number, b: number, epsilon = 0.00001): boolean {
  return Math.abs(a - b) < epsilon;
}

export function vecEqual<T>(a: T[], b: T[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function vec3TupleApproxEquals(
  a: THREE.Vector3Tuple,
  b: THREE.Vector3Tuple,
  epsilon = 0.00001,
): boolean {
  return (
    approxEquals(a[0], b[0], epsilon) &&
    approxEquals(a[1], b[1], epsilon) &&
    approxEquals(a[2], b[2], epsilon)
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
