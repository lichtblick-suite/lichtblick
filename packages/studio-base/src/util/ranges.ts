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
  complement,
  intersect,
  isBefore,
  isDuring,
  isMeeting,
  isOverlappingSimple,
} from "intervals-fn";

export type Range = {
  start: number;
  /* inclusive */
  end: number;
};

export function isRangeCoveredByRanges(
  queryRange: Range,
  nonOverlappingMergedAndSortedRanges: Range[],
): boolean {
  for (const range of nonOverlappingMergedAndSortedRanges) {
    if (isBefore(queryRange, range)) {
      return false;
    }
    if (isDuring(queryRange, range)) {
      return true;
    }
  }
  return false;
}

// Get the ranges in `bounds` that are NOT covered by `ranges`.
export function missingRanges(bounds: Range, ranges: readonly Range[]): Range[] {
  // `complement` works in unexpected ways when `ranges` has a range that exceeds `bounds`,
  // so we first clip `ranges` to `bounds`.
  return complement(bounds, intersect([bounds], ranges));
}

// Given a list of unsorted, non-overlapping ranges, and a new range, produce another such list,
// with the new range in the first position, with any ranges that overlapped the new range merged
// into it.
export function mergeNewRangeIntoUnsortedNonOverlappingList(
  newRange: Range,
  unsortedNonOverlappingRanges: readonly Range[],
): Range[] {
  let firstRange = newRange;
  const newRanges = [];
  for (const range of unsortedNonOverlappingRanges) {
    if (isOverlappingSimple(firstRange, range) || isMeeting(firstRange, range)) {
      firstRange = {
        start: Math.min(range.start, firstRange.start),
        end: Math.max(range.end, firstRange.end),
      };
    } else {
      newRanges.push(range);
    }
  }
  return [firstRange, ...newRanges];
}
