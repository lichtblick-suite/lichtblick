// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { cameraStateValidator, point2DValidator } from "./validate";

describe("cameraStateValidator", () => {
  it("returns undefined for empty object input", () => {
    const cameraState = {};
    expect(cameraStateValidator(cameraState)).toBe(undefined);
  });
  it("returns error if one field is invalid", () => {
    const cameraState = { distance: "abc" };
    expect(cameraStateValidator(cameraState)).toEqual({
      distance: "must be a number",
    });
  });
  it("returns the first error if one field has multiple errors", () => {
    const cameraState = { targetOrientation: [1, 1, 1] };
    expect(cameraStateValidator(cameraState)).toEqual({
      targetOrientation: "must contain 4 array items",
    });
  });
  it("returns error if the quaternion number sum for targetOrientation is not between 0.9 and 1.1", () => {
    let cameraState = { targetOrientation: [0, 0, 0, 0.94] };
    expect(cameraStateValidator(cameraState)).toEqual({
      targetOrientation: "must be valid quaternion",
    });
    cameraState = { targetOrientation: [0.32, 1, 0, 0] };
    expect(cameraStateValidator(cameraState)).toEqual({
      targetOrientation: "must be valid quaternion",
    });
    cameraState = { targetOrientation: [1.04, 0, 0, 0] };
    expect(cameraStateValidator(cameraState)).toEqual(undefined);
    cameraState = { targetOrientation: [0.95, 0, 0, 0] };
    expect(cameraStateValidator(cameraState)).toEqual(undefined);
  });

  it("returns error if the vec3/vec4 values are set but are invalid", () => {
    const cameraState = { targetOffset: ["invalid"] };
    expect(cameraStateValidator(cameraState)).toEqual({
      targetOffset: "must contain 3 array items",
    });

    const cameraState1 = { targetOffset: [1, 1, "abc"] };
    expect(cameraStateValidator(cameraState1)).toEqual({
      targetOffset: `must contain only numbers in the array. "abc" is not a number.`,
    });

    const cameraState2 = { targetOrientation: [1, 1, 1] };
    expect(cameraStateValidator(cameraState2)).toEqual({
      targetOrientation: "must contain 4 array items",
    });
  });

  it("combines errors from different fields", () => {
    const cameraState = {
      distance: "abc",
      targetOffset: [1, 12, "121"],
      targetOrientation: [1, 1, 1],
    };
    expect(cameraStateValidator(cameraState)).toEqual({
      distance: "must be a number",
      targetOffset: 'must contain only numbers in the array. "121" is not a number.',
      targetOrientation: "must contain 4 array items",
    });

    const cameraState1 = {
      distance: "abc",
      targetOffset: [1, 12, "121"],
      targetOrientation: [1, 1, 1, 1],
    };

    expect(cameraStateValidator(cameraState1)).toEqual({
      targetOrientation: "must be valid quaternion",
      distance: "must be a number",
      targetOffset: 'must contain only numbers in the array. "121" is not a number.',
    });
  });
});

describe("point2DValidator", () => {
  it("returns undefined for valid input", () => {
    expect(point2DValidator({ x: 1, y: 2 })).toEqual(undefined);
  });
  it("returns error for non-array input", () => {
    expect(point2DValidator({})).toEqual({ x: "is required", y: "is required" });
    expect(point2DValidator()).toEqual({ x: "is required", y: "is required" });
    expect(point2DValidator("")).toEqual({ x: "is required", y: "is required" });
    expect(point2DValidator([])).toEqual({ x: "is required", y: "is required" });
    expect(point2DValidator(123)).toEqual({ x: "is required", y: "is required" });
  });

  it("returns error when x/y field validation fails", () => {
    expect(point2DValidator({ x: 1 })).toEqual({ y: "is required" });
    expect(point2DValidator({ x: "1" })).toEqual({ x: "must be a number", y: "is required" });
    expect(point2DValidator({ x: 1, y: "2" })).toEqual({ y: "must be a number" });
  });
});
