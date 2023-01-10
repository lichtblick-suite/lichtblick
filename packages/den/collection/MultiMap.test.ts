// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MultiMap } from "./MultiMap";

describe("MultiMap", () => {
  it("get/set", () => {
    const map = new MultiMap<number, string>();
    expect(map.get(1)).toBeUndefined();

    map.set(1, "a");
    expect(map.get(1)).toEqual(["a"]);

    map.set(1, "b");
    expect(map.get(1)).toEqual(["a", "b"]);

    map.set(1, "a");
    expect(map.get(1)).toEqual(["a", "b"]);

    map.set(2, "a");
    expect(map.get(1)).toEqual(["a", "b"]);
    expect(map.get(2)).toEqual(["a"]);
  });

  it("delete", () => {
    const map = new MultiMap<number, string>();
    map.set(1, "a");
    map.set(1, "b");
    map.delete(1, "a");
    expect(map.get(1)).toEqual(["b"]);
    map.delete(1, "b");
    expect(map.get(1)).toBeUndefined();
  });

  it("clear", () => {
    const map = new MultiMap<number, string>();
    map.set(1, "a");
    map.set(1, "b");
    map.clear();
    expect(map.get(1)).toBeUndefined();
  });
});
