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

import useChangeDetector from "@foxglove/studio-base/hooks/useChangeDetector";

describe("useChangeDetector", () => {
  it("returns true only when value changes", () => {
    for (const initialValue of [true, false]) {
      const { result, rerender } = renderHook(
        (deps) => useChangeDetector(deps, { initiallyTrue: initialValue }),
        {
          initialProps: [1, 1],
        },
      );
      expect(result.current).toBe(initialValue);
      rerender([1, 1]);
      expect(result.current).toBe(false);
      rerender([2, 1]);
      expect(result.current).toBe(true);
      rerender([2, 1]);
      expect(result.current).toBe(false);
      rerender([2, 2]);
      expect(result.current).toBe(true);
      rerender([2, 2]);
      expect(result.current).toBe(false);
    }
  });

  it("uses reference equality", () => {
    const obj = {};
    const { result, rerender } = renderHook(
      (deps) => useChangeDetector(deps, { initiallyTrue: false }),
      {
        initialProps: [1, "a", obj],
      },
    );
    expect(result.current).toBe(false);
    rerender([1, "a", obj]);
    expect(result.current).toBe(false);
    rerender([1, "a", {}]);
    expect(result.current).toBe(true);
    rerender([1, "a", obj]);
    expect(result.current).toBe(true);
    rerender([1, "a", obj]);
    expect(result.current).toBe(false);
  });
});
