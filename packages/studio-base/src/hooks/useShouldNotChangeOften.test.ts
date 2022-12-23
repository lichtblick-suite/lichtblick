/** @jest-environment jsdom */
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

import { renderHook } from "@testing-library/react-hooks";

import useShouldNotChangeOften from "@foxglove/studio-base/hooks/useShouldNotChangeOften";

describe("useShouldNotChangeOften", () => {
  it("logs when value changes twice in a row", () => {
    const warn = jest.fn();
    const { result, rerender } = renderHook((val) => useShouldNotChangeOften(val, warn), {
      initialProps: "a",
    });
    function update(val: string) {
      rerender(val);
      expect(result.current).toBe(val);
    }
    update("a");
    update("a");
    update("b");
    update("b");
    update("c");
    expect(warn).not.toHaveBeenCalled();
    update("d");
    expect(warn).toHaveBeenCalled();
  });
});
