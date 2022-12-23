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

import { useShallowMemo } from "@foxglove/hooks";

describe("useShallowMemo", () => {
  it("returns original object when shallowly equal", () => {
    {
      const obj = { x: 1 };
      const { result, rerender } = renderHook((val) => useShallowMemo(val), { initialProps: obj });
      expect(result.current).toBe(obj);
      rerender({ x: 1 });
      expect(result.current).toBe(obj);
    }

    {
      const obj = ["abc", 123];
      const { result, rerender } = renderHook((val) => useShallowMemo(val), { initialProps: obj });
      rerender(obj);
      expect(result.current).toBe(obj);
      rerender(["abc", 123]);
      expect(result.current).toBe(obj);
    }

    {
      const obj = ["abc", { x: 1 }];
      const { result, rerender } = renderHook((val) => useShallowMemo(val), { initialProps: obj });
      rerender(obj);
      expect(result.current).toBe(obj);
      rerender(["abc", { x: 1 }]);
      expect(result.current).not.toBe(obj);
    }
  });
});
