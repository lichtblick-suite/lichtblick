// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { act, renderHook } from "@testing-library/react-hooks";
import { useLayoutEffect } from "react";

import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";

import CurrentLayoutContext, { LayoutState, useCurrentLayoutSelector } from "./index";

describe("useCurrentLayoutSelector", () => {
  it("updates when layout changes", () => {
    const state = new CurrentLayoutState({
      selectedLayout: {
        ...DEFAULT_LAYOUT_FOR_TESTS.selectedLayout!,
        data: {
          ...DEFAULT_LAYOUT_FOR_TESTS.selectedLayout!.data,
          configById: { foo: { value: 42 } },
        },
      },
    });
    const { result } = renderHook((selector) => useCurrentLayoutSelector(selector), {
      initialProps: (layoutState: LayoutState) =>
        layoutState.selectedLayout?.data.configById["foo"],
      wrapper({ children }) {
        return (
          <CurrentLayoutContext.Provider value={state}>{children}</CurrentLayoutContext.Provider>
        );
      },
    });

    expect(result.all).toEqual([{ value: 42 }]);

    act(() => state.actions.savePanelConfigs({ configs: [{ id: "foo", config: { value: 1 } }] }));
    expect(result.all).toEqual([{ value: 42 }, { value: 1 }]);
  });

  it("updates when selector changes", () => {
    const state = new CurrentLayoutState({
      selectedLayout: {
        ...DEFAULT_LAYOUT_FOR_TESTS.selectedLayout!,
        data: {
          ...DEFAULT_LAYOUT_FOR_TESTS.selectedLayout!.data,
          configById: {
            foo: { value: 42 },
            bar: { otherValue: 0 },
          },
        },
      },
    });

    const { result, rerender } = renderHook((selector) => useCurrentLayoutSelector(selector), {
      initialProps: (layoutState: LayoutState) =>
        layoutState.selectedLayout?.data.configById["foo"],
      wrapper({ children }) {
        return (
          <CurrentLayoutContext.Provider value={state}>{children}</CurrentLayoutContext.Provider>
        );
      },
    });

    expect(result.all).toEqual([{ value: 42 }]);

    rerender((layoutState) => layoutState.selectedLayout?.data.configById["bar"]);
    expect(result.all).toEqual([{ value: 42 }, { otherValue: 0 }]);
  });

  it("updates when state changes before subscribe", () => {
    const state = new CurrentLayoutState({
      selectedLayout: {
        ...DEFAULT_LAYOUT_FOR_TESTS.selectedLayout!,
        data: {
          ...DEFAULT_LAYOUT_FOR_TESTS.selectedLayout!.data,
          configById: {
            foo: { value: 42 },
            bar: { otherValue: 0 },
          },
        },
      },
    });

    // If a sibling component updates the config in an effect, the config may change before the hook
    // is able to add a listener. It must immediately update with the new value in order to produce
    // consistent results.
    function ChangeState() {
      useLayoutEffect(() => {
        state.actions.updatePanelConfigs("foo", ({ value }) => ({ value: (value as number) + 1 }));
      }, []);
      return ReactNull;
    }

    const { result } = renderHook((selector) => useCurrentLayoutSelector(selector), {
      initialProps: (layoutState: LayoutState) =>
        layoutState.selectedLayout?.data.configById["foo"],
      wrapper({ children }) {
        return (
          <CurrentLayoutContext.Provider value={state}>
            <ChangeState />
            {children}
          </CurrentLayoutContext.Provider>
        );
      },
    });

    expect(result.all).toEqual([{ value: 42 }, { value: 43 }]);
  });
});
