// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Transform } from "@foxglove/studio-base/panels/ThreeDeeRender/transforms/Transform";

import { AddTransformResult, TransformTree } from "./TransformTree";

const tf = Transform.Identity();
describe("TransformTree", () => {
  it("updates tree when adding a transform that would not create a cycle", () => {
    const tfTree = new TransformTree();
    tfTree.addTransform("b", "a", 0n, tf);
    tfTree.addTransform("c", "b", 0n, tf);
    expect(tfTree.addTransform("d", "c", 0n, tf)).toEqual(AddTransformResult.UPDATED);
  });
  it("detects a cycle adding a transform that would create a cycle with 2 frames", () => {
    const tfTree = new TransformTree();
    // a <- b
    tfTree.addTransform("b", "a", 0n, tf);
    // b <- a <- b ERROR - cycle created
    expect(tfTree.addTransform("a", "b", 0n, tf)).toEqual(AddTransformResult.CYCLE_DETECTED);
  });
  it("detects a cycle when adding a transform that would create a cycle with 3 frames", () => {
    const tfTree = new TransformTree();
    // a <- b
    tfTree.addTransform("b", "a", 0n, tf);
    // a <- b <- c
    tfTree.addTransform("c", "b", 0n, tf);
    // c <- a <- b <- c  ERROR - cycle created
    expect(tfTree.addTransform("a", "c", 0n, tf)).toEqual(AddTransformResult.CYCLE_DETECTED);
  });
  it("detects a cycle when adding a transform with a parent as itself", () => {
    const tfTree = new TransformTree();
    expect(tfTree.addTransform("a", "a", 0n, tf)).toEqual(AddTransformResult.CYCLE_DETECTED);
  });

  it("supports deleting frames", () => {
    const tfTree = new TransformTree();
    tfTree.addTransform("b", "a", 0n, tf);
    tfTree.addTransform("c", "b", 0n, tf);
    tfTree.addTransform("c", "b", 1n, tf);
    tfTree.addTransform("d", "a", 0n, tf);

    // Remove non-existent transform is a no-op
    tfTree.removeTransform("c", "a", 0n);
    expect(tfTree.frame("a")).toBeDefined();
    expect(tfTree.frame("b")).toBeDefined();
    expect(tfTree.frame("c")).toBeDefined();
    expect(tfTree.frame("d")).toBeDefined();

    // Remove transform from a->b, a is not deleted because it still has children
    tfTree.removeTransform("b", "a", 0n);
    expect(tfTree.frame("a")).toBeDefined();
    expect(tfTree.frame("b")).toBeDefined();
    expect(tfTree.frame("c")).toBeDefined();
    expect(tfTree.frame("d")).toBeDefined();

    // Remove transform at 0 from b->c, nothing is deleted because there's still a transform at time 1
    tfTree.removeTransform("c", "b", 0n);
    expect(tfTree.frame("a")).toBeDefined();
    expect(tfTree.frame("b")).toBeDefined();
    expect(tfTree.frame("c")).toBeDefined();
    expect(tfTree.frame("d")).toBeDefined();

    // Remove transform at 1 from b->c, b and c can now be deleted, a->d still exists
    tfTree.removeTransform("c", "b", 1n);
    expect(tfTree.frame("a")).toBeDefined();
    expect(tfTree.frame("b")).toBeUndefined();
    expect(tfTree.frame("c")).toBeUndefined();
    expect(tfTree.frame("d")).toBeDefined();

    tfTree.removeTransform("d", "a", 0n);
    expect(tfTree.frame("a")).toBeUndefined();
    expect(tfTree.frame("b")).toBeUndefined();
    expect(tfTree.frame("c")).toBeUndefined();
    expect(tfTree.frame("d")).toBeUndefined();
  });
});
