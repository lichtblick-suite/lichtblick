// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { unwrap } from "./unwrap";

describe("unwrap", () => {
  it("returns a defined value", () => {
    expect(unwrap<string | undefined>("hello")).toEqual("hello");
  });
  it("throws for undefined value", () => {
    expect(() => unwrap(undefined)).toThrow("Invariant: unexpected undefined value");
  });
  it("throws for null value", () => {
    // eslint-disable-next-line no-restricted-syntax
    expect(() => unwrap(null)).toThrow("Invariant: unexpected undefined value");
  });
});
