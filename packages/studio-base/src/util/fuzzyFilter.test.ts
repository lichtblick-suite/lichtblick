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

import fuzzyFilter from "./fuzzyFilter";

describe("fuzzyFilter", () => {
  it("filters correctly", () => {
    expect(fuzzyFilter({ options: ["abc", "def"], filter: "a", getText: (x) => x })).toEqual([
      "abc",
    ]);
    expect(fuzzyFilter({ options: ["abc", "def"], filter: "e", getText: (x) => x })).toEqual([
      "def",
    ]);
    expect(fuzzyFilter({ options: ["abc", "def"], filter: "aa", getText: (x) => x })).toEqual([]);
    expect(fuzzyFilter({ options: ["abc", "def"], filter: "z", getText: (x) => x })).toEqual([]);
  });
  it("sorts better matches first", () => {
    expect(fuzzyFilter({ options: ["abbc", "abc"], filter: "abc", getText: (x) => x })).toEqual([
      "abc",
      "abbc",
    ]);
    expect(fuzzyFilter({ options: ["abb", "ab"], filter: "ab", getText: (x) => x })).toEqual([
      "ab",
      "abb",
    ]);
  });
  it("allows disabling sorting", () => {
    expect(
      fuzzyFilter({ options: ["abbc", "abc"], filter: "abc", getText: (x) => x, sort: false }),
    ).toEqual(["abbc", "abc"]);
    expect(
      fuzzyFilter({ options: ["abb", "ab"], filter: "ab", getText: (x) => x, sort: false }),
    ).toEqual(["abb", "ab"]);
  });
  it("ignores punctuation and capitalization", () => {
    expect(fuzzyFilter({ options: ["ab/cDE"], filter: "a-b_Cde", getText: (x) => x })).toEqual([
      "ab/cDE",
    ]);
  });
  it("supports custom objects", () => {
    expect(
      fuzzyFilter({ options: [{ x: "abc" }, { x: "def" }], filter: "a", getText: ({ x }) => x }),
    ).toEqual([{ x: "abc" }]);
  });
});
