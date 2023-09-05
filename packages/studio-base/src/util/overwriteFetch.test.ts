// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import overwriteFetch from "./overwriteFetch";

describe("overwriteFetch", () => {
  afterEach(() => {
    // reset the test
    global.fetch = async () => {
      throw new Error("not available");
    };
  });

  it("overwrites the default fetch", async () => {
    const originalError = new TypeError("Failed to fetch");
    global.fetch = async () => {
      throw originalError;
    };

    overwriteFetch();
    let error;
    try {
      await fetch("url");
    } catch (err) {
      error = err;
    }
    // We should have replaced the original error with our new error.
    expect(error).not.toBe(originalError);
    expect(error?.message).toEqual("Failed to fetch: url");
  });

  it("does not touch unrelated errrors", async () => {
    const originalError = new TypeError("a different error");
    global.fetch = async () => {
      throw originalError;
    };

    overwriteFetch();
    let error;
    try {
      await fetch("url");
    } catch (err) {
      error = err;
    }
    // We should have kept the original error.
    expect(error).toBe(originalError);
  });
});
