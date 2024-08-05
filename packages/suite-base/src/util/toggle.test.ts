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

import toggle from "./toggle";

describe("Array toggle", () => {
  const items = [{ foo: "bar" }, { foo: "baz" }];

  it("uses shallow equality by default", () => {
    const arr = toggle(items, items[0]);
    expect(arr).toEqual([{ foo: "baz" }]);
    expect(items).toBe(items);
    expect(arr).not.toBe(items);
  });

  it("removes item if predicate returns true for it", () => {
    const arr = toggle(items, { foo: "bar" }, (item) => item.foo === "bar");
    expect(arr).toEqual([{ foo: "baz" }]);
    expect(items).toBe(items);
    expect(arr).not.toBe(items);
  });

  it("adds item if predicate returns false for everything", () => {
    const arr = toggle(items, { foo: "bar" }, () => false);
    expect(arr).toEqual([{ foo: "bar" }, { foo: "baz" }, { foo: "bar" }]);
    expect(items).toBe(items);
    expect(arr).not.toBe(items);
  });
});
