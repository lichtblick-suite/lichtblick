// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { sortedIndexByTuple } from "./binarySearch";

describe("binarySearch", () => {
  describe("sortedIndexByTuple", () => {
    it("should find the first element even if multiple match", () => {
      const idx = sortedIndexByTuple(
        [
          [1n, 1],
          [2n, 2],
          [2n, 3],
          [4n, 4],
        ],
        2n,
      );
      expect(idx).toEqual(1);
    });
  });
});
