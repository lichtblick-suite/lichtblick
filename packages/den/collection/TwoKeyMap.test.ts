// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TwoKeyMap } from "./TwoKeyMap";

describe("TwoKeyMap", () => {
  it("supports basic operations", () => {
    const map = new TwoKeyMap<string, string, number>();

    map.set("a", "a", 1);
    expect(map.get("a", "a")).toBe(1);
    expect(map.get("a", "b")).toBe(undefined);
    expect(map.get("b", "a")).toBe(undefined);
    expect([...map.values()]).toEqual([1]);

    map.set("a", "b", 2);
    expect(map.get("a", "a")).toBe(1);
    expect(map.get("a", "b")).toBe(2);
    expect(map.get("a", "c")).toBe(undefined);
    expect([...map.values()]).toEqual([1, 2]);

    map.delete("a", "a");
    expect(map.get("a", "a")).toBe(undefined);
    expect(map.get("a", "b")).toBe(2);
    expect([...map.values()]).toEqual([2]);

    map.deleteAll("a");
    expect(map.get("a", "a")).toBe(undefined);
    expect(map.get("a", "b")).toBe(undefined);
    expect([...map.values()]).toEqual([]);

    map.set("a", "a", 1);
    map.set("a", "b", 2);
    map.set("x", "y", 3);
    map.set("x", "z", 4);
    expect([...map.values()]).toEqual([1, 2, 3, 4]);

    map.deleteAll("a");
    expect([...map.values()]).toEqual([3, 4]);

    map.clear();
    expect([...map.values()]).toEqual([]);
  });
});
