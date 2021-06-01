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

import { polygonsToPoints, pointsToPolygons, getFormattedString } from "./drawToolUtils";

const points = [
  [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ],
  [
    { x: 4, y: 4 },
    { x: 5, y: 5 },
    { x: 6, y: 6 },
  ],
];
const polygons = [
  {
    active: false,
    id: 1,
    name: "0",
    points: [
      { active: false, id: 2, point: [1, 1, 0] },
      { active: false, id: 3, point: [2, 2, 0] },
      { active: false, id: 4, point: [3, 3, 0] },
    ],
  },
  {
    active: false,
    id: 5,
    name: "1",
    points: [
      { active: false, id: 6, point: [4, 4, 0] },
      { active: false, id: 7, point: [5, 5, 0] },
      { active: false, id: 8, point: [6, 6, 0] },
    ],
  },
];

describe("drawToolUtils", () => {
  describe("polygonsToPoints", () => {
    it("converts polygons to points", async () => {
      expect(polygonsToPoints(polygons)).toEqual(points);
    });
  });
  describe("pointsToPolygons", () => {
    it("converts polygon points to polygons", () => {
      expect(pointsToPolygons(points)).toEqual(polygons);
    });
  });
  describe("getFormattedString", () => {
    it("returns json format", async () => {
      expect(JSON.parse(getFormattedString(points))).toEqual(points);
    });
    it("handles empty input for json format", async () => {
      expect(getFormattedString([])).toEqual("[]");
    });
  });
});
