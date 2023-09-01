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

import { derivative } from "./datasets";
import { applyToDatum, mathFunctions } from "./transformPlotRange";

const ZERO_TIME = Object.freeze({ sec: 0, nsec: 0 });

describe("transformPlotRange", () => {
  describe("derivative", () => {
    it("takes the derivative using the previous message", () => {
      const data = [
        {
          x: new Float32Array([0, 1, 2, 3]),
          y: new Float32Array([0, -1, -1.5, 5]),
          value: [0, -1, -1.5, 5],
          receiveTime: [ZERO_TIME, ZERO_TIME, ZERO_TIME, ZERO_TIME],
        },
      ];

      const newData = [
        {
          constantName: undefined,
          headerStamp: undefined,
          x: new Float32Array([1, 2, 3]),
          y: new Float32Array([-1, -0.5, 6.5]),
          value: [-1, -0.5, 6.5],
          receiveTime: [ZERO_TIME, ZERO_TIME, ZERO_TIME],
        },
      ];
      expect(derivative(data)).toEqual(newData);
    });
  });

  // This is a good example of math functions, if this one works then the rest of them should work.
  describe("absoluteValue", () => {
    it("takes the absolute value of tooltips", () => {
      const datums = [
        { x: 0, y: NaN },
        { x: 1, y: -1 },
        { x: 2, y: 1.5 },
        { x: 2, y: -1.5 },
      ];

      const expected = [
        { x: 0, y: NaN, value: NaN },
        { x: 1, y: 1, value: 1 },
        { x: 2, y: 1.5, value: 1.5 },
        { x: 2, y: 1.5, value: 1.5 },
      ];

      for (const [idx, datum] of datums.entries()) {
        expect(applyToDatum(datum, mathFunctions.abs!)).toEqual(expected[idx]);
      }
    });
  });

  it("rad2deg converts radians to degrees", () => {
    expect(applyToDatum({ y: Math.PI }, mathFunctions.rad2deg!)).toEqual({
      y: 180,
      value: 180,
    });
  });

  it("deg2rad converts degrees to radians", () => {
    expect(applyToDatum({ y: 180 }, mathFunctions.deg2rad!)).toEqual({
      y: Math.PI,
      value: Math.PI,
    });
  });
});
