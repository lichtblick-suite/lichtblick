/** @jest-environment jsdom */
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

import { renderHook } from "@testing-library/react-hooks";

import useCleanup from "./useCleanup";

describe("useCleanup", () => {
  class Example {
    destroyed: boolean;
    constructor() {
      this.destroyed = false;
    }
    destroy() {
      this.destroyed = true;
    }
  }

  it("calls the teardown function when component is unmounted", () => {
    const value = new Example();
    const { unmount } = renderHook(() => useCleanup(() => value.destroy()));
    expect(value.destroyed).toBe(false);
    unmount();
    expect(value.destroyed).toBe(true);
  });
});
