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

import filterMap from "./filterMap";

describe("filterMap", () => {
  it("behaves like map()+filter(Boolean)", () => {
    expect(filterMap([], (x) => x)).toEqual([]);
    expect(filterMap([1, 2, 3], (x, i) => x === i + 1)).toEqual([true, true, true]);
    expect(filterMap([0, 1, 2], (x) => x)).toEqual([1, 2]);
    expect(filterMap([0, 1, 2], (x) => x - 1)).toEqual([-1, 1]);
    expect(filterMap([0, 1, 2], () => true)).toEqual([true, true, true]);
    expect(filterMap([0, 1, 2], () => 0)).toEqual([]);
    expect(filterMap([0, 1, 2], () => undefined)).toEqual([]);
    expect(filterMap([0, 1, 2], () => NaN)).toEqual([]);
    expect(filterMap([0, 1, 2], () => null)).toEqual([]); // eslint-disable-line no-restricted-syntax
    expect(filterMap([0, 1, 2], () => "")).toEqual([]);
    expect(filterMap([0, 1, 2], () => false)).toEqual([]);
  });
});
