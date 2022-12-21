/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { act, renderHook } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";

import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";

import { LayoutState, useCurrentLayoutActions, useCurrentLayoutSelector } from "./index";

describe("useCurrentLayoutSelector", () => {
  it("updates when layout changes", async () => {
    const { result } = renderHook(
      ({ selector }) => ({
        actions: useCurrentLayoutActions(),
        value: useCurrentLayoutSelector(selector),
      }),
      {
        initialProps: {
          selector: (layoutState: LayoutState) =>
            layoutState.selectedLayout?.data?.configById["foo"],
        },
        wrapper({ children }) {
          return (
            <MockCurrentLayoutProvider initialState={{ configById: { foo: { value: 42 } } }}>
              {children}
            </MockCurrentLayoutProvider>
          );
        },
      },
    );

    expect(result.current.value).toEqual({ value: 42 });

    await act(() => {
      result.current.actions.savePanelConfigs({ configs: [{ id: "foo", config: { value: 1 } }] });
    });
    expect(result.current.value).toEqual({ value: 1 });
  });

  it("updates when selector changes", () => {
    const { result, rerender } = renderHook(
      ({ selector }) => ({
        actions: useCurrentLayoutActions(),
        value: useCurrentLayoutSelector(selector),
      }),
      {
        initialProps: {
          selector: (layoutState: LayoutState) =>
            layoutState.selectedLayout?.data?.configById["foo"],
        },
        wrapper({ children }) {
          return (
            <MockCurrentLayoutProvider
              initialState={{
                configById: {
                  foo: { value: 42 },
                  bar: { otherValue: 0 },
                },
              }}
            >
              {children}
            </MockCurrentLayoutProvider>
          );
        },
      },
    );

    expect(result.current.value).toEqual({ value: 42 });

    rerender({ selector: (layoutState) => layoutState.selectedLayout?.data?.configById["bar"] });
    expect(result.current.value).toEqual({ otherValue: 0 });
  });

  it("updates when state changes before subscribe", () => {
    // If a sibling component updates the config in an effect, the config may change before the hook
    // is able to add a listener. It must immediately update with the new value in order to produce
    // consistent results.
    function ChangeState() {
      const actions = useCurrentLayoutActions();
      const actionsRef = useRef(actions);
      actionsRef.current = actions;
      useLayoutEffect(() => {
        actionsRef.current.updatePanelConfigs("foo", ({ value }) => ({
          value: (value as number) + 1,
        }));
      }, []);
      return ReactNull;
    }

    const all: unknown[] = [];
    renderHook(
      ({ selector }) => {
        const value = useCurrentLayoutSelector(selector);
        all.push(value);
        return {
          actions: useCurrentLayoutActions(),
          value,
        };
      },
      {
        initialProps: {
          selector: (layoutState: LayoutState) =>
            layoutState.selectedLayout?.data?.configById["foo"],
        },
        wrapper({ children }) {
          return (
            <MockCurrentLayoutProvider
              initialState={{
                configById: {
                  foo: { value: 42 },
                  bar: { otherValue: 0 },
                },
              }}
            >
              <ChangeState />
              {children}
            </MockCurrentLayoutProvider>
          );
        },
      },
    );

    expect(all).toEqual([{ value: 42 }, { value: 43 }]);
  });
});
