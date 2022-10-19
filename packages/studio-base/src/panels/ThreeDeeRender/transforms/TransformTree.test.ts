// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Transform } from "@foxglove/studio-base/panels/ThreeDeeRender/transforms/Transform";

import { AddTransformResult, TransformTree } from "./TransformTree";

const tf = Transform.Identity();
const bigint = BigInt("0");
describe("TransformTree", () => {
  it("updates tree when adding a transform that would not create a cycle", () => {
    const tfTree = new TransformTree();
    tfTree.addTransform("b", "a", bigint, tf);
    tfTree.addTransform("c", "b", bigint, tf);
    expect(tfTree.addTransform("d", "c", bigint, tf)).toEqual(AddTransformResult.UPDATED);
  });
  it("detects a cycle adding a transform that would create a cycle with 2 frames", () => {
    const tfTree = new TransformTree();
    // a <- b
    tfTree.addTransform("b", "a", bigint, tf);
    // b <- a <- b ERROR - cycle created
    expect(tfTree.addTransform("a", "b", bigint, tf)).toEqual(AddTransformResult.CYCLE_DETECTED);
  });
  it("detects a cycle when adding a transform that would create a cycle with 3 frames", () => {
    const tfTree = new TransformTree();
    // a <- b
    tfTree.addTransform("b", "a", bigint, tf);
    // a <- b <- c
    tfTree.addTransform("c", "b", bigint, tf);
    // c <- a <- b <- c  ERROR - cycle created
    expect(tfTree.addTransform("a", "c", bigint, tf)).toEqual(AddTransformResult.CYCLE_DETECTED);
  });
});
