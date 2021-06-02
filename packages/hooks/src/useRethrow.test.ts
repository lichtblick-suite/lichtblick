// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react-hooks";

import useRethrow from "./useRethrow";

describe("useRethrow", () => {
  it("should catch errors thrown", () => {
    const { result } = renderHook(() => {
      return useRethrow(() => {
        throw new Error("foobar");
      });
    });

    act(() => {
      result.current();
    });
    expect(result.error?.message).toEqual("foobar");
  });
});
