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

import { MutablePose, Orientation, Point } from "@foxglove/studio-base/types/Messages";

// contains backing classes for point, orientation, and pose
// because we create them a _lot_
class PointClass {
  x: number = 0;
  y: number = 0;
  z: number = 0;

  static empty() {
    const point = new PointClass();
    point.x = 0;
    point.y = 0;
    point.z = 0;
    return point;
  }
}

class OrientationClass {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  w: number = 0;

  static empty() {
    const orientation = new OrientationClass();
    orientation.x = 0;
    orientation.y = 0;
    orientation.z = 0;
    orientation.w = 1;
    return orientation;
  }
}

class PoseClass {
  position: Point = { x: 0, y: 0, z: 0 };
  orientation: Orientation = { x: 0, y: 0, z: 0, w: 0 };
}

// create a new empty pose object
export function emptyPose(): MutablePose {
  const pose = new PoseClass();
  pose.position = PointClass.empty();
  pose.orientation = OrientationClass.empty();
  return pose;
}
