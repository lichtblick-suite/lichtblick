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

import {
  isRangeCoveredByRanges,
  missingRanges,
  mergeNewRangeIntoUnsortedNonOverlappingList,
  Range,
} from "./ranges";

describe("ranges", () => {
  describe("isRangeCoveredByRanges", () => {
    it("returns true if there is a range that fully contains the queryRange", () => {
      expect(
        isRangeCoveredByRanges({ start: 5, end: 7 }, [
          { start: 0, end: 1 },
          { start: 4, end: 10 },
          { start: 12, end: 20 },
        ]),
      ).toEqual(true);
      expect(isRangeCoveredByRanges({ start: 5, end: 7 }, [{ start: 5, end: 7 }])).toEqual(true);
    });

    it("returns false if there is no range that fully contains the queryRange", () => {
      expect(isRangeCoveredByRanges({ start: 5, end: 7 }, [{ start: 0, end: 1 }])).toEqual(false);
      expect(
        isRangeCoveredByRanges({ start: 5, end: 7 }, [
          { start: 3, end: 6 },
          { start: 7, end: 10 },
        ]),
      ).toEqual(false);
    });
  });

  describe("missingRanges", () => {
    it("returns the bounds when `ranges` is empty", () => {
      const bounds = { start: 0, end: 10 };
      const ranges: Range[] = [];
      expect(missingRanges(bounds, ranges)).toEqual([bounds]);
    });

    it("returns the complement of the ranges within the bounds", () => {
      const bounds = { start: 0, end: 10 };
      const ranges = [
        { start: 1, end: 2 },
        { start: 7, end: 9 },
      ];
      expect(missingRanges(bounds, ranges)).toEqual([
        { start: 0, end: 1 },
        { start: 2, end: 7 },
        { start: 9, end: 10 },
      ]);
    });

    it("works with ranges outside of the bounds", () => {
      const bounds = { start: 0, end: 10 };
      const ranges = [
        { start: -10, end: 2 },
        { start: 7, end: 20 },
      ];
      expect(missingRanges(bounds, ranges)).toEqual([{ start: 2, end: 7 }]);
    });
  });

  describe("mergeNewRangeIntoUnsortedNonOverlappingList", () => {
    it("returns `newRange` when `ranges` is empty", () => {
      const newRange = { start: 20, end: 30 };
      const unsortedNonOverlappingRanges: Range[] = [];
      expect(
        mergeNewRangeIntoUnsortedNonOverlappingList(newRange, unsortedNonOverlappingRanges),
      ).toEqual([newRange]);
    });

    it("keeps the returned list unsorted", () => {
      const newRange = { start: 20, end: 30 };
      const unsortedNonOverlappingRanges = [{ start: 0, end: 10 }];
      expect(
        mergeNewRangeIntoUnsortedNonOverlappingList(newRange, unsortedNonOverlappingRanges),
      ).toEqual([
        { start: 20, end: 30 },
        { start: 0, end: 10 },
      ]);
    });

    it("merges with an overlapping range", () => {
      const newRange = { start: 20, end: 30 };
      const unsortedNonOverlappingRanges = [
        { start: 25, end: 35 },
        { start: 0, end: 10 },
      ];
      expect(
        mergeNewRangeIntoUnsortedNonOverlappingList(newRange, unsortedNonOverlappingRanges),
      ).toEqual([
        { start: 20, end: 35 },
        { start: 0, end: 10 },
      ]);
    });

    it("merges with a touching range", () => {
      const newRange = { start: 20, end: 30 };
      const unsortedNonOverlappingRanges = [
        { start: 30, end: 40 },
        { start: 0, end: 10 },
      ];
      expect(
        mergeNewRangeIntoUnsortedNonOverlappingList(newRange, unsortedNonOverlappingRanges),
      ).toEqual([
        { start: 20, end: 40 },
        { start: 0, end: 10 },
      ]);
    });

    it("merges with multiple ranges at once", () => {
      const newRange = { start: 20, end: 30 };
      const unsortedNonOverlappingRanges = [
        { start: 30, end: 40 },
        { start: 0, end: 10 },
        { start: 15, end: 25 },
      ];
      expect(
        mergeNewRangeIntoUnsortedNonOverlappingList(newRange, unsortedNonOverlappingRanges),
      ).toEqual([
        { start: 15, end: 40 },
        { start: 0, end: 10 },
      ]);
    });
  });
});
