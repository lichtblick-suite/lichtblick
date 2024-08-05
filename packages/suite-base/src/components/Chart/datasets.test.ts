// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { findIndices } from "./datasets";

describe("findIndices", () => {
  it("ignores empty slices", () => {
    expect(
      findIndices(
        [
          {
            x: new Float32Array(),
            y: new Float32Array(),
            value: [],
          },
          {
            x: new Float32Array(1),
            y: new Float32Array(1),
            value: ["foo"],
          },
        ],
        0,
      ),
    ).toEqual([1, 0]);
  });
  it("calculates index correctly", () => {
    expect(
      findIndices(
        [
          {
            x: new Float32Array(3),
            y: new Float32Array(3),
            value: [1, 2, 3],
          },
          {
            x: new Float32Array(1),
            y: new Float32Array(1),
            value: [4],
          },
        ],
        3,
      ),
    ).toEqual([1, 0]);
  });
});
