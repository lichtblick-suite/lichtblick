// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { ColorRGBA, Vector3 } from "./ros";
import type { Pose } from "./transforms";

export type BaseShape = {
  pose: Pose;
  scale: Vector3;
  color?: ColorRGBA;
};

export type MouseEventObject = {
  object: BaseShape;
  instanceIndex?: number;
};

export type CameraState = {
  distance: number;
  perspective: boolean;
  phi: number;
  target: readonly [number, number, number];
  targetOffset: readonly [number, number, number];
  targetOrientation: readonly [number, number, number, number];
  thetaOffset: number;
  fovy: number;
  near: number;
  far: number;
};

export const DEFAULT_CAMERA_STATE: CameraState = {
  distance: 20,
  perspective: true,
  phi: 60,
  target: [0, 0, 0],
  targetOffset: [0, 0, 0],
  targetOrientation: [0, 0, 0, 1],
  thetaOffset: 45,
  fovy: 45,
  near: 0.01,
  far: 5000,
};
