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

import { derivative, applyToDatum, mathFunctions } from "./transformPlotRange";

describe("transformPlotRange", () => {
  describe("derivative", () => {
    it("takes the derivative using the previous message", () => {
      const data = [
        {
          x: 0,
          y: 0,
          value: 0,
          constantName: undefined,
        },
        {
          x: 1,
          y: -1,
          value: -1,
          constantName: undefined,
        },
        {
          x: 2,
          y: -1.5,
          value: -1.5,
          constantName: undefined,
        },
        {
          x: 3,
          y: 5,
          value: 5,
          constantName: undefined,
        },
      ];

      const newData = [
        {
          x: 1,
          y: -1,
          value: -1,
          constantName: undefined,
        },
        {
          x: 2,
          y: -0.5,
          value: -0.5,
          constantName: undefined,
        },
        {
          x: 3,
          y: 6.5,
          value: 6.5,
          constantName: undefined,
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
