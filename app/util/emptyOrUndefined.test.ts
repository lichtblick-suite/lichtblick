// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  nonEmptyOrUndefined,
  isNonEmptyOrUndefined,
} from "@foxglove-studio/app/util/emptyOrUndefined";

describe("isEmptyOrUndefined", () => {
  it("returns true when given a non-empty string", () => {
    expect(isNonEmptyOrUndefined(undefined)).toBe(false);
    expect(isNonEmptyOrUndefined("")).toBe(false);
    expect(isNonEmptyOrUndefined("a")).toBe(true);
  });
});

describe("nonEmptyOrUndefined", () => {
  it("returns undefined when given undefined or empty string", () => {
    expect(nonEmptyOrUndefined(undefined)).toBeUndefined();
    expect(nonEmptyOrUndefined("")).toBeUndefined();
    expect(nonEmptyOrUndefined("a")).toBe("a");
  });
});
