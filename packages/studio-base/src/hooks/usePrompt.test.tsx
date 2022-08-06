/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen, fireEvent, act } from "@testing-library/react";

import ModalHost from "@foxglove/studio-base/context/ModalHost";

import { usePrompt } from "./usePrompt";

describe("usePrompt", () => {
  it("cleans up extra nodes added", async () => {
    let prompt: ReturnType<typeof usePrompt> | undefined;
    const Test = () => {
      prompt = usePrompt();
      return ReactNull;
    };
    const root = render(
      <ModalHost>
        <Test />
      </ModalHost>,
    );
    const start = document.body.childNodes.length;
    let promise: Promise<string | undefined> | undefined;
    act(() => {
      promise = prompt!({ title: "Hello" });
    });
    expect(promise).toBeDefined();
    expect(document.body.childNodes.length).toEqual(start + 1);
    root.unmount();
    expect(document.body.childNodes.length).toEqual(start);
    await expect(promise).resolves.toBeUndefined();
  });

  it("should support a title and placeholder", async () => {
    let prompt: ReturnType<typeof usePrompt> | undefined;
    const Test = () => {
      prompt = usePrompt();
      return ReactNull;
    };
    const root = render(
      <ModalHost>
        <Test />
      </ModalHost>,
    );

    act(() => {
      void prompt!({
        title: "test-title",
        placeholder: "test-placeholder",
      });
    });

    await expect(screen.findByText("test-title")).resolves.not.toBeNullOrUndefined();
    const input = await screen.findByPlaceholderText<HTMLInputElement>("test-placeholder");
    expect(input.value).toEqual("");
    root.unmount();
  });

  it("should return entered value", async () => {
    let prompt: ReturnType<typeof usePrompt> | undefined;
    const Test = () => {
      prompt = usePrompt();
      return ReactNull;
    };
    const root = render(
      <ModalHost>
        <Test />
      </ModalHost>,
    );
    let valPromise: Promise<string | undefined> | undefined;
    act(() => {
      valPromise = prompt!({
        title: "test-title",
        placeholder: "test-placeholder",
      });
    });
    expect(valPromise).toBeDefined();

    const input = await screen.findByPlaceholderText("test-placeholder");
    fireEvent.change(input, { target: { value: "something" } });

    const submitButton = screen.getByText("OK");
    act(() => submitButton.click());

    await expect(valPromise).resolves.toEqual("something");
    root.unmount();
  });

  it("should use an initial value", async () => {
    let prompt: ReturnType<typeof usePrompt> | undefined;
    const Test = () => {
      prompt = usePrompt();
      return ReactNull;
    };
    const root = render(
      <ModalHost>
        <Test />
      </ModalHost>,
    );
    let valPromise: Promise<string | undefined> | undefined;
    act(() => {
      valPromise = prompt!({
        title: "test-title",
        initialValue: "initial-value",
        placeholder: "some-placeholder",
      });
    });
    expect(valPromise).toBeDefined();

    const input = await screen.findByPlaceholderText<HTMLInputElement>("some-placeholder");
    expect(input.value).toEqual("initial-value");

    const submitButton = screen.getByText("OK");
    act(() => submitButton.click());

    await expect(valPromise).resolves.toEqual("initial-value");
    root.unmount();
  });
});
