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

import { Point } from "@foxglove/studio-base/types/Messages";

// a single min/max value
class Bound {
  min: number = Number.MAX_SAFE_INTEGER;
  max: number = Number.MIN_SAFE_INTEGER;

  // update the bound based on a value
  update(value: number) {
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);
  }

  reset() {
    this.min = Number.MAX_SAFE_INTEGER;
    this.max = Number.MIN_SAFE_INTEGER;
  }
}

// represents x, y, and z min & max bounds for a 3d scene
export default class Bounds {
  x: Bound;
  y: Bound;
  z: Bound;

  constructor() {
    this.x = new Bound();
    this.y = new Bound();
    this.z = new Bound();
  }

  // update the bounds based on a point
  update(point: Point): void {
    this.x.update(point.x);
    this.y.update(point.y);
    this.z.update(point.z);
  }

  reset(): void {
    this.x.reset();
    this.y.reset();
    this.z.reset();
  }
}
