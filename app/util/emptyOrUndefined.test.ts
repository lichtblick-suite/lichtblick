// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  nonEmptyOrUndefined,
  isNonEmptyOrUndefined,
} from "@foxglove/studio-base/util/emptyOrUndefined";

describe("isEmptyOrUndefined", () => {
  it("returns true when given a non-empty string", () => {
    expect(isNonEmptyOrUndefined(undefined)).toBe(false);
    expect(isNonEmptyOrUndefined("")).toBe(false);
    expect(isNonEmptyOrUndefined("a")).toBe(true);
  });
  it("returns true when given a non-empty array", () => {
    expect(isNonEmptyOrUndefined(undefined)).toBe(false);
    expect(isNonEmptyOrUndefined([])).toBe(false);
    expect(isNonEmptyOrUndefined([0])).toBe(true);
    expect(isNonEmptyOrUndefined([undefined])).toBe(true);
    expect(isNonEmptyOrUndefined(["x"])).toBe(true);
  });
});

describe("nonEmptyOrUndefined", () => {
  it("returns undefined when given undefined or empty string", () => {
    expect(nonEmptyOrUndefined(undefined)).toBeUndefined();
    expect(nonEmptyOrUndefined("")).toBeUndefined();
    expect(nonEmptyOrUndefined("a")).toBe("a");
  });
});
