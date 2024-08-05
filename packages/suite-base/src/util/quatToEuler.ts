// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();

/**
 * Convert a quaternion to roll-pitch-yaw Euler angles.
 */
export function quatToEuler(
  x: number,
  y: number,
  z: number,
  w: number,
): [roll: number, pitch: number, yaw: number] {
  tempQuaternion.set(x, y, z, w);
  tempEuler.setFromQuaternion(tempQuaternion, "XYZ");
  return [
    THREE.MathUtils.radToDeg(tempEuler.x),
    THREE.MathUtils.radToDeg(tempEuler.y),
    THREE.MathUtils.radToDeg(tempEuler.z),
  ];
}
