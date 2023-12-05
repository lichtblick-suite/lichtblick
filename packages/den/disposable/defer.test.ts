// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { defer } from "./defer";

describe("defer", () => {
  it("should call the provided function when disposed", () => {
    let called = false;

    {
      // eslint-disable-next-line no-underscore-dangle
      using _disposable = defer(() => {
        called = true;
      });

      expect(called).toBe(false);
    }
    expect(called).toBe(true);
  });

  it("should call the provided function with throw in scope", () => {
    let called = false;

    function foo() {
      // eslint-disable-next-line no-underscore-dangle
      using _disposable = defer(() => {
        called = true;
      });

      expect(called).toBe(false);
      throw new Error("some error");
    }

    expect(foo).toThrow();
    expect(called).toBe(true);
  });
});
