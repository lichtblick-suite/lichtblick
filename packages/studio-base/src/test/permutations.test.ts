// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import permutations from "./permutations";

describe("getPermutations", () => {
  it("returns every order of the input elements", () => {
    const perms = [...permutations([1, 2, 3])].map((numbers) => numbers.join(","));
    expect(new Set(perms)).toEqual(new Set(["1,2,3", "1,3,2", "2,1,3", "2,3,1", "3,1,2", "3,2,1"]));
  });
});
