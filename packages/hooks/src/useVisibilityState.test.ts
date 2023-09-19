/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react";

import useVisibilityState from "./useVisibilityState";

describe("useVisibilityState", () => {
  it("returns document visibility state and tracks changes", () => {
    const visibilityState = jest.spyOn(document, "visibilityState", "get");
    visibilityState.mockImplementation(() => "hidden");

    const { result } = renderHook(() => useVisibilityState());
    expect(result.current).toEqual("hidden");

    visibilityState.mockImplementation(() => "visible");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current).toEqual("visible");

    visibilityState.mockImplementation(() => "hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current).toEqual("hidden");
  });
});
