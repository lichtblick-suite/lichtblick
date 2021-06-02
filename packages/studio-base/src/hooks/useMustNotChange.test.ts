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

import useMustNotChange from "@foxglove/studio-base/hooks/useMustNotChange";

describe("useMustNotChange", () => {
  it("throws when value changes", () => {
    const { result, rerender } = renderHook((val) => useMustNotChange(val, "hi"), {
      initialProps: 1,
    });
    rerender(1);
    expect(result.current).toBe(1);
    rerender(2);
    expect(result.error).toEqual(new Error("hi\nOld: 1\nNew: 2"));
  });
});
