// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PromiseTimeoutError, promiseTimeout } from "@foxglove/den/async";

describe("promiseTimeout", () => {
  it("throws a PromiseTimeoutError when the promise times out", async () => {
    const contender = new Promise((resolve) => setTimeout(resolve, 100));
    await expect(promiseTimeout(contender, 10)).rejects.toThrow(PromiseTimeoutError);
  });

  it("returns the value from the promise", async () => {
    await expect(promiseTimeout(Promise.resolve(42), 10)).resolves.toEqual(42);
  });

  it("returns the rejection from the promise", async () => {
    await expect(promiseTimeout(Promise.reject(new Error("oops")), 10)).rejects.toThrow(
      new Error("oops"),
    );
  });
});
