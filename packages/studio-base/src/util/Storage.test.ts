/** @jest-environment jsdom */
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

import MemoryStorage from "@foxglove/studio-base/test/MemoryStorage";

import Storage from "./Storage";

describe("Storage", () => {
  it("returns void on a missing key", () => {
    const storage = new Storage(new MemoryStorage());
    expect(storage.getItem("foo.bar")).toBe(undefined);
  });

  it("round-trips strings", () => {
    const storage = new Storage(new MemoryStorage());
    expect(storage.setItem("foo", "bar")).toBe(undefined);
    expect(storage.getItem("foo")).toBe("bar");
  });

  it("round-trips objects", () => {
    const storage = new Storage(new MemoryStorage());
    storage.setItem("foo", { bar: "baz", qux: true });
    expect(storage.getItem("foo")).toEqual({ bar: "baz", qux: true });
  });

  it("returns undefined on unparsable json", () => {
    const backingStore = new MemoryStorage();
    backingStore.setItem("foo", "bar");
    const storage = new Storage(backingStore);
    expect(storage.getItem("foo")).toBe(undefined);
  });
});
