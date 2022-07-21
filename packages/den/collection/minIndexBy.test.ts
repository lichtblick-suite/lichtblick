// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { minIndexBy } from "./minIndexBy";

describe("minIndexBy", () => {
  it("should return -1 for empty", () => {
    const idx = minIndexBy([], () => -1);
    expect(idx).toEqual(-1);
  });

  it("should find an index matching the min item", () => {
    const idx = minIndexBy([3, 5, 1, 3], (a, b) => a - b);
    expect(idx).toEqual(2);
  });

  it("should find an index matching the min item when size is 1", () => {
    const idx = minIndexBy([3], (a, b) => a - b);
    expect(idx).toEqual(0);
  });

  it("should work with multiple smallest values", () => {
    const idx = minIndexBy([3, 2, 1, 1, 1], (a, b) => a - b);
    expect(idx).toEqual(2);
  });
});
