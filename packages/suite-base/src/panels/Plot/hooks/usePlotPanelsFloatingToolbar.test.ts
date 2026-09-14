/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { LayoutState } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

import usePlotPanelsFloatingToolbar from "./usePlotPanelsFloatingToolbar";

const mockUseCurrentLayoutSelector = jest.fn();

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutSelector: (selector: (state: LayoutState) => boolean) =>
    mockUseCurrentLayoutSelector(selector),
}));

describe("usePlotPanelsFloatingToolbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Given the layout data has plotPanelsFloatingToolbar true When reading the value Then it returns true", () => {
    // Given
    const layoutState: LayoutState = {
      selectedLayout: {
        id: LayoutBuilder.layoutId(),
        data: LayoutBuilder.data({ plotPanelsFloatingToolbar: true }),
      },
    };
    mockUseCurrentLayoutSelector.mockImplementation((selector) => selector(layoutState));

    // When
    const { result } = renderHook(() => usePlotPanelsFloatingToolbar());

    // Then
    expect(result.current).toBe(true);
  });

  it("Given the layout data has plotPanelsFloatingToolbar false When reading the value Then it returns false", () => {
    // Given
    const layoutState: LayoutState = {
      selectedLayout: {
        id: LayoutBuilder.layoutId(),
        data: LayoutBuilder.data({ plotPanelsFloatingToolbar: false }),
      },
    };
    mockUseCurrentLayoutSelector.mockImplementation((selector) => selector(layoutState));

    // When
    const { result } = renderHook(() => usePlotPanelsFloatingToolbar());

    // Then
    expect(result.current).toBe(false);
  });

  it("Given the layout data does not set plotPanelsFloatingToolbar When reading the value Then it defaults to false", () => {
    // Given
    const layoutState: LayoutState = {
      selectedLayout: {
        id: LayoutBuilder.layoutId(),
        data: LayoutBuilder.data({ plotPanelsFloatingToolbar: undefined }),
      },
    };
    mockUseCurrentLayoutSelector.mockImplementation((selector) => selector(layoutState));

    // When
    const { result } = renderHook(() => usePlotPanelsFloatingToolbar());

    // Then
    expect(result.current).toBe(false);
  });

  it("Given no layout is selected When reading the value Then it defaults to false", () => {
    // Given
    const layoutState: LayoutState = { selectedLayout: undefined };
    mockUseCurrentLayoutSelector.mockImplementation((selector) => selector(layoutState));

    // When
    const { result } = renderHook(() => usePlotPanelsFloatingToolbar());

    // Then
    expect(result.current).toBe(false);
  });
});
