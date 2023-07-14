// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as maps from "./maps";

describe("merges", () => {
  it("merges maps", () => {
    const inputA = new Map([
      ["a", 1],
      ["b", 2],
    ]);

    const inputB = new Map([
      ["a", 10],
      ["b", 20],
      ["c", 30],
    ]);

    const assigned = maps.merge(inputA, inputB, (a, b) => a * b);

    expect(assigned).toEqual(
      new Map([
        ["a", 10],
        ["b", 40],
        ["c", 30],
      ]),
    );
  });
});

describe("mapValues", () => {
  it("maps values", () => {
    const input = new Map([
      ["a", 1],
      ["b", 2],
    ]);

    const mapped = maps.mapValues(input, (value, key) => `${key}/${value * 10}`);

    expect(mapped).toEqual(
      new Map([
        ["a", "a/10"],
        ["b", "b/20"],
      ]),
    );
  });
});

describe("pick", () => {
  it("picks by key", () => {
    const input = new Map([
      ["a", 1],
      ["b", 2],
      ["c", 3],
      ["d", 4],
    ]);

    const picked = maps.pick(input, ["b", "d", "z"]);

    expect(picked).toEqual(
      new Map([
        ["b", 2],
        ["d", 4],
      ]),
    );
  });
});
