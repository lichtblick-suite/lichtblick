// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";

import { useMustNotChangeImpl } from "./useMustNotChange";

describe("useMustNotChange", () => {
  it("should throw when value changes", () => {
    const { result, rerender } = renderHook((val) => useMustNotChangeImpl(val), {
      initialProps: 1,
    });
    rerender(2);

    expect(result.error?.message).toEqual("Value must not change");
  });
});
