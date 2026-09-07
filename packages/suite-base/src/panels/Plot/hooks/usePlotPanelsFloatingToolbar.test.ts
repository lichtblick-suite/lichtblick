/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import usePlotPanelsFloatingToolbar from "./usePlotPanelsFloatingToolbar";

const mockUseCurrentLayoutSelector = jest.fn();

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutSelector: (selector: any) => mockUseCurrentLayoutSelector(selector),
}));

describe("usePlotPanelsFloatingToolbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Given the layout data has plotPanelsFloatingToolbar true When reading the value Then it returns true", () => {
    // Given
    mockUseCurrentLayoutSelector.mockImplementation((selector) =>
      selector({ selectedLayout: { data: { plotPanelsFloatingToolbar: true } } }),
    );

    // When
    const { result } = renderHook(() => usePlotPanelsFloatingToolbar());

    // Then
    expect(result.current).toBe(true);
  });

  it("Given the layout data has plotPanelsFloatingToolbar false When reading the value Then it returns false", () => {
    // Given
    mockUseCurrentLayoutSelector.mockImplementation((selector) =>
      selector({ selectedLayout: { data: { plotPanelsFloatingToolbar: false } } }),
    );

    // When
    const { result } = renderHook(() => usePlotPanelsFloatingToolbar());

    // Then
    expect(result.current).toBe(false);
  });

  it("Given the layout data does not set plotPanelsFloatingToolbar When reading the value Then it defaults to false", () => {
    // Given
    mockUseCurrentLayoutSelector.mockImplementation((selector) =>
      selector({ selectedLayout: { data: {} } }),
    );

    // When
    const { result } = renderHook(() => usePlotPanelsFloatingToolbar());

    // Then
    expect(result.current).toBe(false);
  });

  it("Given no layout is selected When reading the value Then it defaults to false", () => {
    // Given
    mockUseCurrentLayoutSelector.mockImplementation((selector) =>
      selector({ selectedLayout: undefined }),
    );

    // When
    const { result } = renderHook(() => usePlotPanelsFloatingToolbar());

    // Then
    expect(result.current).toBe(false);
  });
});
