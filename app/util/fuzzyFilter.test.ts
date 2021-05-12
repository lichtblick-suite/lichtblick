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
    expect(fuzzyFilter(["abc", "def"], "a", (x) => x)).toEqual(["abc"]);
    expect(fuzzyFilter(["abc", "def"], "e", (x) => x)).toEqual(["def"]);
    expect(fuzzyFilter(["abc", "def"], "aa", (x) => x)).toEqual([]);
    expect(fuzzyFilter(["abc", "def"], "z", (x) => x)).toEqual([]);
  });
  it("sorts better matches first", () => {
    expect(fuzzyFilter(["abbc", "abc"], "abc", (x) => x)).toEqual(["abc", "abbc"]);
    expect(fuzzyFilter(["abb", "ab"], "ab", (x) => x)).toEqual(["ab", "abb"]);
  });
  it("allows disabling sorting", () => {
    expect(fuzzyFilter(["abbc", "abc"], "abc", (x) => x, false)).toEqual(["abbc", "abc"]);
    expect(fuzzyFilter(["abb", "ab"], "ab", (x) => x, false)).toEqual(["abb", "ab"]);
  });
  it("ignores punctuation and capitalization", () => {
    expect(fuzzyFilter(["ab/cDE"], "a-b_Cde", (x) => x)).toEqual(["ab/cDE"]);
  });
  it("supports custom objects", () => {
    expect(fuzzyFilter([{ x: "abc" }, { x: "def" }], "a", ({ x }) => x)).toEqual([{ x: "abc" }]);
  });
});
