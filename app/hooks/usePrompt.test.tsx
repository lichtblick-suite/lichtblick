// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { screen, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks/dom";

import { usePrompt } from "./usePrompt";

describe("usePrompt", () => {
  it("should cleanup any extra nodes added", () => {
    const start = document.body.childNodes.length;
    const { unmount } = renderHook(() => usePrompt());
    expect(document.body.childNodes.length).toEqual(start + 1);
    unmount();
    expect(document.body.childNodes.length).toEqual(start);
  });

  it("should support a placeholder", async () => {
    const { result, unmount } = renderHook(() => usePrompt());

    result.current({
      placeholder: "test-placeholder",
    });

    const input = screen.getByPlaceholderText("test-placeholder") as HTMLInputElement;
    expect(input.value).toEqual("");
    unmount();
  });

  it("should return entered value", async () => {
    const { result, unmount } = renderHook(() => usePrompt());
    const valPromise = result.current({
      placeholder: "test-placeholder",
    });

    const input = screen.getByPlaceholderText("test-placeholder");
    fireEvent.change(input, { target: { value: "something" } });

    const submitButton = screen.getByText("OK");
    submitButton.click();

    const val = await valPromise;
    expect(val).toEqual("something");
    unmount();
  });

  it("should use an initial value", async () => {
    const { result, unmount } = renderHook(() => usePrompt());
    const valPromise = result.current({
      value: "initial-value",
      placeholder: "some-placeholder",
    });

    const input = screen.getByPlaceholderText("some-placeholder") as HTMLInputElement;
    expect(input.value).toEqual("initial-value");

    const submitButton = screen.getByText("OK");
    submitButton.click();

    const val = await valPromise;
    expect(val).toEqual("initial-value");
    unmount();
  });
});
