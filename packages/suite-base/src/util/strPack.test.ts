// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import strPack from "./strPack";

describe("strPack", () => {
  it("rewrites an object", () => {
    const map = new Map<string, string>();
    map.set("foo", "bar");
    const before = {
      test: 2,
      ok: ["ok"],
      map,
    };
    expect(strPack(before)).toEqual(before);
  });
});
