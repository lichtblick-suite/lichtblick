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

import { MutablePose } from "@foxglove/studio-base/types/Messages";

// Create a new empty pose object
export function emptyPose(): MutablePose {
  return { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
}

// Perform a deep copy of a pose object
export function clonePose(pose: MutablePose): MutablePose {
  const p = pose.position;
  const o = pose.orientation;
  return { position: { x: p.x, y: p.y, z: p.z }, orientation: { x: o.x, y: o.y, z: o.z, w: o.w } };
}

// Reset a pose object to the identity pose
export function setIdentityPose(pose: MutablePose): void {
  pose.position.x = 0;
  pose.position.y = 0;
  pose.position.z = 0;
  pose.orientation.x = 0;
  pose.orientation.y = 0;
  pose.orientation.z = 0;
  pose.orientation.w = 1;
}
