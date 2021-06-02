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

import concatAndTruncate from "./concatAndTruncate";

describe("concatAndTruncate", () => {
  it("can truncate down to zero", () => {
    expect(concatAndTruncate([1, 2, 3], [4, 5, 6], 0)).toEqual([]);
    expect(concatAndTruncate([], [1, 2, 3], 0)).toEqual([]);
    expect(concatAndTruncate([1, 2, 3], [], 0)).toEqual([]);
    expect(concatAndTruncate([], [], 0)).toEqual([]);
  });

  it("works when no truncation is necessary", () => {
    expect(concatAndTruncate([1, 2, 3], [4, 5, 6], Infinity)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(concatAndTruncate([1, 2, 3], [4, 5, 6], 100)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(concatAndTruncate([1, 2, 3], [4, 5, 6], 6)).toEqual([1, 2, 3, 4, 5, 6]);

    expect(concatAndTruncate([], [1, 2, 3], Infinity)).toEqual([1, 2, 3]);
    expect(concatAndTruncate([], [1, 2, 3], 100)).toEqual([1, 2, 3]);
    expect(concatAndTruncate([], [1, 2, 3], 3)).toEqual([1, 2, 3]);

    expect(concatAndTruncate([1, 2, 3], [], Infinity)).toEqual([1, 2, 3]);
    expect(concatAndTruncate([1, 2, 3], [], 100)).toEqual([1, 2, 3]);
    expect(concatAndTruncate([1, 2, 3], [], 3)).toEqual([1, 2, 3]);
  });

  it("can truncate into the middle of the first array", () => {
    expect(concatAndTruncate([1, 2, 3], [], 2)).toEqual([2, 3]);
    expect(concatAndTruncate([1, 2, 3], [4, 5], 3)).toEqual([3, 4, 5]);
  });

  it("can truncate into the middle of the second array", () => {
    expect(concatAndTruncate([], [1, 2, 3], 2)).toEqual([2, 3]);
    expect(concatAndTruncate([0], [1, 2, 3], 2)).toEqual([2, 3]);
  });

  it("can return just the second array", () => {
    expect(concatAndTruncate([], [1, 2, 3], 3)).toEqual([1, 2, 3]);
    expect(concatAndTruncate([0], [1, 2, 3], 3)).toEqual([1, 2, 3]);
  });
});
