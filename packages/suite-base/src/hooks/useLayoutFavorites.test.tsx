/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import LayoutManagerContext from "@lichtblick/suite-base/context/LayoutManagerContext";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";

import { useLayoutFavorites } from "./useLayoutFavorites";

function setup() {
  const layoutManager = new MockLayoutManager();
  layoutManager.favorites = { personal: new Set(["personal-1"]), shared: new Set() };
  function Wrapper({ children }: PropsWithChildren): React.JSX.Element {
    return (
      <LayoutManagerContext.Provider value={layoutManager}>
        {children}
      </LayoutManagerContext.Provider>
    );
  }
  const hook = renderHook(() => useLayoutFavorites(), { wrapper: Wrapper });
  const favoritesListener = () =>
    layoutManager.on.mock.calls.find(([event]) => event === "favoriteschange")?.[1] as () => void;
  return { ...hook, layoutManager, favoritesListener };
}

describe("useLayoutFavorites", () => {
  it("Given favorites in the layout manager, when rendered, then returns them", () => {
    const { result, layoutManager } = setup();

    expect(result.current).toBe(layoutManager.favorites);
  });

  it("Given a rendered hook, when the favorites change, then returns the new favorites", () => {
    const { result, layoutManager, favoritesListener } = setup();
    const next = { personal: new Set<string>(), shared: new Set(["shared-1"]) };

    act(() => {
      layoutManager.favorites = next;
      favoritesListener()();
    });

    expect(result.current).toBe(next);
  });

  it("Given a rendered hook, when unmounted, then stops listening to favorites changes", () => {
    const { unmount, layoutManager, favoritesListener } = setup();
    const listener = favoritesListener();

    unmount();

    expect(layoutManager.off).toHaveBeenCalledWith("favoriteschange", listener);
  });
});
