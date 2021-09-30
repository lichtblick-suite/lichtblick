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

import { Time, fromSec } from "@foxglove/rostime";
import permutations from "@foxglove/studio-base/test/permutations";

import { getBagChunksOverlapCount } from "./bags";

const expectChunkOverlaps = (
  elements: { startTime: Time; endTime: Time }[],
  expectedSize: number,
) => {
  for (const permutation of permutations(elements)) {
    expect(getBagChunksOverlapCount(permutation)).toBe(expectedSize);
  }
};

const times = (input: [number, number][]) =>
  input.map(([start, end]) => ({
    startTime: fromSec(start),
    endTime: fromSec(end),
  }));

describe("getBagChunksOverlapCount", () => {
  it("returns zero when chunks do not overlap", () => {
    const elements = times([
      [1, 2],
      [2, 3],
      [3.5, 5],
      [6, 6],
      [6, 6],
      [6.5, 7],
    ]);
    expectChunkOverlaps(elements, 0);
  });

  it("returns one when two elements overlap", () => {
    const elements = times([
      [0, 1],
      [1, 2],
      [1.9, 2.1],
      [3, 4],
    ]);
    expectChunkOverlaps(elements, 1);
  });

  it("returns two when two separate pairs of elements overlap", () => {
    const elements = times([
      [0, 1],
      [0.5, 1.5],
      [4, 5],
      [6, 7],
      [6.5, 7.5],
    ]);
    expectChunkOverlaps(elements, 2);
  });

  it("returns the number of elements minus one when they all overlap", () => {
    const elements = times([
      [0, 1],
      [0, 1],
      [0.5, 1.5],
      [0.9, 1.9],
    ]);
    expectChunkOverlaps(elements, 3);
  });
});
