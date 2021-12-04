// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { emptyPose } from "@foxglove/studio-base/util/Pose";

import { Transform } from "./Transform";
import { mat4FromValues, quatFromValues, vec3FromValues } from "./geometry";

describe("Transform", () => {
  it("should create an instance", () => {
    const tf = Transform.Identity();
    expect(tf.position()).toEqual([0, 0, 0]);
    expect(tf.rotation()).toEqual([0, 0, 0, 1]);
    expect(tf.matrix()).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it("copy", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(4, 5, 6, 7));
    const tf2 = Transform.Identity();
    tf2.copy(tf);
    expect(tf2.position()).toEqual([1, 2, 3]);
    expect(tf2.rotation()).toEqual([4, 5, 6, 7]);
    expect(tf2.matrix()).toEqual([
      -121, 124, -22, 0, -44, -103, 116, 0, 118, 4, -81, 0, 1, 2, 3, 1,
    ]);
  });

  it("setPosition", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(4, 5, 6, 7));
    tf.setPosition(vec3FromValues(10, 20, 30));
    expect(tf.position()).toEqual([10, 20, 30]);
    expect(tf.rotation()).toEqual([4, 5, 6, 7]);
    expect(tf.matrix()).toEqual([
      -121, 124, -22, 0, -44, -103, 116, 0, 118, 4, -81, 0, 10, 20, 30, 1,
    ]);
  });

  it("setRotation", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(4, 5, 6, 7));
    tf.setRotation(quatFromValues(40, 50, 60, 70));
    expect(tf.position()).toEqual([1, 2, 3]);
    expect(tf.rotation()).toEqual([40, 50, 60, 70]);
    expect(tf.matrix()).toEqual([
      -12199, 12400, -2200, 0, -4400, -10399, 11600, 0, 11800, 400, -8199, 0, 1, 2, 3, 1,
    ]);
  });

  it("setPositionRotation", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(4, 5, 6, 7));
    tf.setPositionRotation(vec3FromValues(10, 20, 30), quatFromValues(40, 50, 60, 70));
    expect(tf.position()).toEqual([10, 20, 30]);
    expect(tf.rotation()).toEqual([40, 50, 60, 70]);
    expect(tf.matrix()).toEqual([
      -12199, 12400, -2200, 0, -4400, -10399, 11600, 0, 11800, 400, -8199, 0, 10, 20, 30, 1,
    ]);
  });

  it("setMatrix", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(4, 5, 6, 7));
    tf.setMatrix([
      -12199, 12400, -2200, 0, -4400, -10399, 11600, 0, 11800, 400, -8199, 0, 10, 20, 30, 1,
    ]);
    expect(tf.position()).toEqual([10, 20, 30]);
    expect(tf.rotation()).toEqual([
      0.26152369579692475, 0.2799390689932134, 0.6647845516193718, 0.3681753124784878,
    ]);
    expect(tf.matrix()).toEqual([
      -12199, 12400, -2200, 0, -4400, -10399, 11600, 0, 11800, 400, -8199, 0, 10, 20, 30, 1,
    ]);

    tf.setMatrix(mat4FromValues(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1));
    expect(tf.position()).toEqual([0, 0, 0]);
    expect(tf.rotation()).toEqual([0, 0, 0, 1]);
    expect(tf.matrix()).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it("setPose", () => {
    const tf = Transform.Identity();
    tf.setPose({ position: { x: 1, y: 2, z: 3 }, orientation: { x: 4, y: 5, z: 6, w: 7 } });
    expect(tf.position()).toEqual([1, 2, 3]);
    expect(tf.rotation()).toEqual([4, 5, 6, 7]);
    expect(tf.matrix()).toEqual([-121, 124, -22, 0, -44, -103, 116, 0, 118, 4, -81, 0, 1, 2, 3, 1]);
  });

  it("toPose", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(4, 5, 6, 7));
    const pose = emptyPose();
    tf.toPose(pose);
    expect(pose.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(pose.orientation).toEqual({ x: 4, y: 5, z: 6, w: 7 });
  });
});
