// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import fetchMock from "fetch-mock";

import { enforceFetchIsBlocked, inWebWorker, inSharedWorker } from "./workers";

describe("inWebWorker", () => {
  it("returns false in unit tests", () => {
    // Difficult to get positive cases in Jest, but covered by integration tests.
    expect(inWebWorker()).toBe(false);
  });
});

describe("inSharedWorker", () => {
  it("returns false in unit tests", () => {
    // Difficult to get positive cases in Jest, but covered by integration tests.
    expect(inSharedWorker()).toBe(false);
  });
});

describe("enforceFetchIsBlocked", () => {
  afterEach(() => {
    fetchMock.restore();
  });

  it("throws when fetch works", async () => {
    fetchMock.get("test", 200);
    const wrappedFn = enforceFetchIsBlocked(() => "test");
    expect(wrappedFn).toBeInstanceOf(Function);
    await expect(wrappedFn()).rejects.toThrow("Content security policy too loose.");
  });

  it("returns the output of the wrapped function when fetch fails", async () => {
    fetchMock.get("test", { throws: new Error("hi!") });
    const wrappedFn = enforceFetchIsBlocked((arg) => `test${arg}`);
    expect(wrappedFn).toBeInstanceOf(Function);
    await expect(wrappedFn(1)).resolves.toBe("test1");
  });
});
