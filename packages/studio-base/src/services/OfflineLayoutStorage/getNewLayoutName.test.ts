// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import getNewLayoutName from "./getNewLayoutName";

describe("getNewLayoutName", () => {
  it.each([
    { name: "Foo", existing: [], expected: "Foo" },
    { name: "Foo", existing: ["Foo"], expected: "Foo 1" },
    { name: "Foo", existing: ["Foo", "Foo 1", "Foo 2"], expected: "Foo 3" },
    { name: "Foo", existing: ["Foo1"], expected: "Foo" },

    { name: "Foo1", existing: [], expected: "Foo1" },
    { name: "Foo1", existing: ["Foo1"], expected: "Foo1 1" },
    { name: "Foo1", existing: ["Foo1 1"], expected: "Foo1" },
    { name: "Foo1", existing: ["Foo1", "Foo1 1"], expected: "Foo1 2" },

    { name: "1", existing: [], expected: "1" },
    { name: "1", existing: ["1"], expected: "1 1" },
    { name: "1", existing: ["1", "1 1"], expected: "1 2" },

    { name: " 1", existing: [], expected: " 1" },
    { name: " 1", existing: [" 1"], expected: " 1 1" },
    { name: " 1", existing: [" 1", " 1 1"], expected: " 1 2" },
  ])(
    "returns '$expected' for '$name' with existing names $existing",
    ({ name, existing, expected }) => {
      expect(getNewLayoutName(name, new Set(existing))).toBe(expected);
    },
  );
});
