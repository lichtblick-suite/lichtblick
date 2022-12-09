// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PinholeCameraModel } from "@foxglove/den/image";

import { Vector2, Vector3 } from "../ros";

const tempVec2 = { x: 0, y: 0 };
const tempVec3a = { x: 0, y: 0, z: 0 };
const tempVec3b = { x: 0, y: 0, z: 0 };

export function projectPixel(
  out: Vector3,
  uv: Readonly<Vector2>,
  cameraModel: PinholeCameraModel,
  settings: { distance: number; planarProjectionFactor: number },
): Vector3 {
  cameraModel.rectifyPixel(tempVec2, uv);

  if (settings.planarProjectionFactor === 0) {
    cameraModel.projectPixelTo3dRay(out, tempVec2);
  } else if (settings.planarProjectionFactor === 1) {
    cameraModel.projectPixelTo3dPlane(out, tempVec2);
  } else {
    cameraModel.projectPixelTo3dRay(tempVec3a, tempVec2);
    cameraModel.projectPixelTo3dPlane(tempVec3b, tempVec2);
    lerpVec3(out, tempVec3a, tempVec3b, settings.planarProjectionFactor);
  }

  multiplyScalar(out, settings.distance);
  return out;
}

function lerpVec3(out: Vector3, a: Readonly<Vector3>, b: Readonly<Vector3>, t: number): void {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
}

function multiplyScalar(vec: Vector3, scalar: number): void {
  vec.x *= scalar;
  vec.y *= scalar;
  vec.z *= scalar;
}
