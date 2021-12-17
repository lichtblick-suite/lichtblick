// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { emptyPose } from "@foxglove/studio-base/util/Pose";

import { Transform } from "./Transform";
import { TransformTree } from "./TransformTree";

const TIME_ZERO = { sec: 0, nsec: 0 };
const EMPTY_POSE = emptyPose();

describe("TransformTree", () => {
  it("should create an instance", () => {
    const tree = new TransformTree();
    expect(tree.frame("")).toBeUndefined();
    expect(tree.frame("test")).toBeUndefined();
    expect(tree.frames().size).toBe(0);
    expect(tree.hasFrame("")).toBe(false);
    expect(tree.hasFrame("test")).toBe(false);
  });

  it("getOrCreateFrame", () => {
    const tree = new TransformTree();
    const baseLink = tree.getOrCreateFrame("base_link");
    expect(baseLink.id).toBe("base_link");
    expect(baseLink.parent()).toBeUndefined();
    expect(baseLink.maxStorageTime).toEqual({ sec: 10, nsec: 0 });
    expect(baseLink.findAncestor("base_link")).toBeUndefined();

    expect(tree.hasFrame("")).toBe(false);
    expect(tree.hasFrame("base_link")).toBe(true);
    expect(tree.frame("base_link")).toBe(baseLink);
    expect(tree.frames().size).toBe(1);
  });

  it("addTransformMessage", () => {
    const tree = new TransformTree();
    tree.addTransformMessage({
      header: { frame_id: "odom", seq: 0, stamp: { sec: 0, nsec: 0 } },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1, y: 2, z: 3 },
        rotation: { x: 1, y: 2, z: 3, w: 4 },
      },
    });
    expect(tree.hasFrame("base_link")).toBe(true);
    expect(tree.hasFrame("odom")).toBe(true);
    expect(tree.hasFrame("")).toBe(false);

    const output = emptyPose();
    expect(tree.apply(output, output, "odom", "base_link", TIME_ZERO)).toBeDefined();
    expect(output.position).toEqual({ x: 1, y: 2, z: 3 });
    // Exact equality is tested to ensure we are using 64-bit math
    expect(output.orientation).toEqual({
      x: 0.1825741858350553,
      y: 0.3651483716701106,
      z: 0.5477225575051661,
      w: 0.7302967433402215,
    });
  });

  it("point-in-time transformation", () => {
    const tree = new TransformTree();
    const map_T_odom = new Transform([0, 0, 0], [0, 0, 0, 1]);
    const odom_T_baseLink = new Transform([0, 0, 0], [0, 0, 0, 1]);
    tree.addTransform("base_link", "odom", TIME_ZERO, odom_T_baseLink);
    tree.addTransform("odom", "map", TIME_ZERO, map_T_odom);
    expect(tree.hasFrame("base_link")).toBe(true);
    expect(tree.hasFrame("odom")).toBe(true);
    expect(tree.hasFrame("map")).toBe(true);
    expect(tree.hasFrame("")).toBe(false);

    // Identity transforms from base_link -> odom -> map
    // const baseLink = tree.frame("base_link")!;
    // const map = tree.frame("map")!;
    const output = emptyPose();
    expect(tree.apply(output, emptyPose(), "map", "base_link", TIME_ZERO)).toBeDefined();
    expect(output.position).toEqual(EMPTY_POSE.position);
    expect(output.orientation).toEqual(EMPTY_POSE.orientation);

    // Identity transforms from map -> odom -> base_link
    expect(tree.apply(output, emptyPose(), "base_link", "map", TIME_ZERO)).toBeDefined();
    expect(output.position).toEqual(EMPTY_POSE.position);
    expect(output.orientation).toEqual(EMPTY_POSE.orientation);

    // This demonstrates that transforms are stored by reference, not by value.
    // Although this works, it's better practice to call addTransform() again
    // with the same timestamp and a new transform
    odom_T_baseLink.setPosition([1, 2, 3]);
    map_T_odom.setPosition([10, 20, 30]);
    map_T_odom.setRotation([0, 0, 1, 0]); // Rotate 180 degrees around z axis

    // base_link -> odom -> map
    expect(tree.apply(output, emptyPose(), "map", "base_link", TIME_ZERO)).toBeDefined();
    expect(output.position).toEqual({ x: 9, y: 18, z: 33 });
    expect(output.orientation).toEqual({ x: 0, y: 0, z: 1, w: 0 });

    // map -> odom -> base_link
    expect(tree.apply(output, emptyPose(), "base_link", "map", TIME_ZERO)).toBeDefined();
    expect(output.position).toEqual({ x: 9, y: 18, z: -33 });
    expect(output.orientation).toEqual({ x: 0, y: 0, z: 1, w: 0 });

    // base_link -> odom -> map
    const a = { position: { x: 100, y: 200, z: 300 }, orientation: { x: 1, y: 0, z: 0, w: 0 } };
    expect(tree.apply(output, a, "map", "base_link", TIME_ZERO)).toBeDefined();
    expect(output.position).toEqual({ x: -91, y: -182, z: 333 });
    expect(output.orientation).toEqual({ x: 0, y: 1, z: 0, w: 0 });

    // map -> odom -> base_link
    expect(tree.apply(output, a, "base_link", "map", TIME_ZERO)).toBeDefined();
    expect(output.position).toEqual({ x: -91, y: -182, z: 267 });
    expect(output.orientation).toEqual({ x: 0, y: 1, z: 0, w: 0 });
  });

  it("reparents", () => {
    const T2 = { sec: 2, nsec: 0 };

    const tree = new TransformTree();
    const map_T_odom = new Transform([1, 2, 3], [0, 0, 0, 1]);
    const odom_T_baseLink = new Transform([4, 5, 6], [0, 0, 0, 1]);
    const world_T_baseLink = new Transform([7, 8, 9], [0, 0, 0, 1]);

    const output = emptyPose();

    tree.addTransform("base_link", "odom", TIME_ZERO, odom_T_baseLink);
    tree.addTransform("odom", "map", TIME_ZERO, map_T_odom);

    expect(tree.apply(output, emptyPose(), "odom", "base_link", TIME_ZERO)).toBeDefined();

    // Reparent
    tree.addTransform("base_link", "world", T2, world_T_baseLink);

    // This will now fail
    expect(tree.apply(output, emptyPose(), "odom", "base_link", TIME_ZERO)).toBeUndefined();
    expect(tree.apply(output, emptyPose(), "map", "base_link", TIME_ZERO)).toBeUndefined();

    // Too far in the past
    expect(tree.apply(output, emptyPose(), "world", "base_link", TIME_ZERO)).toBeUndefined();

    // This works
    expect(tree.apply(output, emptyPose(), "world", "base_link", T2)).toBeDefined();
  });

  it("Clone", () => {
    const tree1 = new TransformTree();
    const tree2 = TransformTree.Clone(tree1);
    expect(tree1.frames()).toBe(tree2.frames());
  });
});
