// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { mat4 } from "gl-matrix";

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
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(0, 1, 0, 0));
    const tf2 = Transform.Identity();
    tf2.copy(tf);
    expect(tf2.position()).toEqual([1, 2, 3]);
    expect(tf2.rotation()).toEqual([0, 1, 0, 0]);
    expect(tf2.matrix()).toEqual([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 1, 2, 3, 1]);
  });

  it("setPosition", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(1, 0, 0, 0));
    tf.setPosition(vec3FromValues(10, 20, 30));
    expect(tf.position()).toEqual([10, 20, 30]);
    expect(tf.rotation()).toEqual([1, 0, 0, 0]);
    expect(tf.matrix()).toEqual([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 10, 20, 30, 1]);
  });

  it("setRotation", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(0, 0, 1, 0));
    tf.setRotation(quatFromValues(0.5, 0.5, 0.5, 0.5));
    expect(tf.position()).toEqual([1, 2, 3]);
    expect(tf.rotation()).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(tf.matrix()).toEqual([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 2, 3, 1]);
  });

  it("setPositionRotation", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(0, 0, 0, 1));
    tf.setPositionRotation(vec3FromValues(10, 20, 30), quatFromValues(1, 0, 0, 0));
    expect(tf.position()).toEqual([10, 20, 30]);
    expect(tf.rotation()).toEqual([1, 0, 0, 0]);
    expect(tf.matrix()).toEqual([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 10, 20, 30, 1]);
  });

  it("setMatrix", () => {
    const M: mat4 = [
      0.03174603174603163, 0.9841269841269841, -0.17460317460317448, 0, -0.3492063492063492,
      0.17460317460317454, 0.9206349206349207, 0, 0.9365079365079365, 0.0317460317460318,
      0.3492063492063493, 0, 10, 20, 30, 1,
    ];

    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(4, 5, 6, 7));
    tf.setMatrix(M);
    expect(tf.position()).toEqual([10, 20, 30]);
    expect(tf.rotation()).toEqual([
      0.3563483225498992, 0.44543540318737396, 0.5345224838248488, 0.6236095644623235,
    ]);
    expect(tf.matrix()).not.toBe(M);
    expect(tf.matrix()).toEqual(M);

    tf.setMatrix(mat4FromValues(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1));
    expect(tf.position()).toEqual([0, 0, 0]);
    expect(tf.rotation()).toEqual([0, 0, 0, 1]);
    expect(tf.matrix()).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it("setPose", () => {
    const tf = Transform.Identity();
    tf.setPose({ position: { x: 1, y: 2, z: 3 }, orientation: { x: 4, y: 5, z: 6, w: 7 } });
    expect(tf.position()).toEqual([1, 2, 3]);
    expect(tf.rotation()).toEqual([
      0.3563483225498992, 0.44543540318737396, 0.5345224838248488, 0.6236095644623235,
    ]);
    expect(tf.matrix()).toEqual([
      0.03174603174603163, 0.9841269841269841, -0.17460317460317448, 0, -0.3492063492063492,
      0.17460317460317454, 0.9206349206349207, 0, 0.9365079365079365, 0.0317460317460318,
      0.3492063492063493, 0, 1, 2, 3, 1,
    ]);
    tf.setMatrix(tf.matrix());
  });

  it("toPose", () => {
    const tf = new Transform(vec3FromValues(1, 2, 3), quatFromValues(4, 5, 6, 7));
    const pose = emptyPose();
    tf.toPose(pose);
    expect(pose.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(pose.orientation).toEqual({
      x: 0.3563483225498992,
      y: 0.44543540318737396,
      z: 0.5345224838248488,
      w: 0.6236095644623235,
    });
  });
});
