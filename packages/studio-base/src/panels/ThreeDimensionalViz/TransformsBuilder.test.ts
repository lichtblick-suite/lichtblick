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

import { mat4 } from "gl-matrix";

import { Transform } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Transforms";
import { getArrowToParentMarkers } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TransformsBuilder";

describe("TransformBuilder", () => {
  describe("getArrowToParentMarkers", () => {
    const invalidParent = new Transform("parent");
    const matrix = mat4.fromValues(1, 0, 0, 2, 1, 0, 0, 1, 0, 0, 1, 0, 2, 0, 1, 2);

    it("does NOT return arrows to invalid parent if is the NOT root", () => {
      const validChild = Object.assign(new Transform("child"), { matrix, parent: invalidParent });
      validChild.set({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1, w: 1 });
      expect(getArrowToParentMarkers("child", validChild, "some_other_root")).toEqual([]);
    });

    it("returns arrows to invalid parent if is the root", () => {
      const validChild = Object.assign(new Transform("child"), { matrix, parent: invalidParent });
      validChild.set({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1, w: 1 });
      expect(getArrowToParentMarkers("child", validChild, "parent")).not.toEqual([]);
    });

    it("does NOT return arrows if the distance between the parent and child is 0", () => {
      const parent = new Transform("parent");
      const child = Object.assign(new Transform("child"), { parent });
      child.set({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1, w: 1 });
      expect(getArrowToParentMarkers("child", child, "some_other_root")).toEqual([]);
    });
  });
});
