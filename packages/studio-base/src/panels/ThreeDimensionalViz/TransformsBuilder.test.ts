// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { getArrowToParentMarker } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TransformsBuilder";
import {
  CoordinateFrame,
  Transform,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";

const ZERO_TIME = { sec: 0, nsec: 0 };

describe("TransformBuilder", () => {
  describe("getArrowToParentMarkers", () => {
    const parent = new CoordinateFrame("parent", undefined);

    it("returns an arrow", () => {
      const child = new CoordinateFrame("child", parent);
      child.addTransform(ZERO_TIME, new Transform([1, 1, 1], [0, 0, 0, 1]));
      expect(getArrowToParentMarker("child", parent, parent, child, ZERO_TIME)).toBeDefined();
    });

    it("does NOT return an arrow if the distance between the parent and child is 0", () => {
      const child = new CoordinateFrame("child", parent);
      child.addTransform(ZERO_TIME, new Transform([0, 0, 0], [0, 0, 0, 1]));
      expect(getArrowToParentMarker("child", parent, parent, child, ZERO_TIME)).toBeUndefined();
    });
  });
});
