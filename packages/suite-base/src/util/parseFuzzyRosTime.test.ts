// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import parseFuzzyRosTime from "./parseFuzzyRosTime";

describe("parseFuzzyRosTime", () => {
  it.each([
    ["1", { sec: 1, nsec: 0 }],
    ["31525401600001", { sec: 31525401600, nsec: 0.001e9 }],
    ["31556937600001", { sec: 31556937, nsec: 0.600001e9 }],
    ["315569376000010", { sec: 315569376, nsec: 0.00001e9 }],
    ["31556937600001000", { sec: 31556937, nsec: 0.600001e9 }],
    ["31556937600001000000", { sec: 31556937, nsec: 0.600001e9 }],
  ])("converts %s to %s", (input, expected) => {
    expect(parseFuzzyRosTime(input)).toEqual(expected);
  });
});
