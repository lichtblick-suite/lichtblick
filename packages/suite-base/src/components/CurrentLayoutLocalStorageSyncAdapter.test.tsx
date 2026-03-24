/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, render } from "@testing-library/react";

import {
  CurrentLayoutLocalStorageSyncAdapter,
  selectLayoutData,
  selectLayoutId,
} from "@lichtblick/suite-base/components/CurrentLayoutLocalStorageSyncAdapter";
import { LOCAL_STORAGE_STUDIO_LAYOUT_KEY } from "@lichtblick/suite-base/constants/browserStorageKeys";
import {
  LayoutData,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import MockCurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => {
  const originalModule = jest.requireActual("@lichtblick/suite-base/context/CurrentLayoutContext");
  return {
    __esModule: true,
    ...originalModule,
    useCurrentLayoutActions: jest.fn(),
    useCurrentLayoutSelector: jest.fn(),
  };
});

jest.mock("@lichtblick/suite-base/context/LayoutManagerContext", () => {
  const originalModule = jest.requireActual("@lichtblick/suite-base/context/LayoutManagerContext");
  return {
    __esModule: true,
    ...originalModule,
    useLayoutManager: jest.fn(),
  };
});

describe("CurrentLayoutLocalStorageSyncAdapter", () => {
  const mockGetCurrentLayoutState = jest.fn();
  const mockLayoutManager = new MockLayoutManager();
  const mockLayoutData: LayoutData = LayoutBuilder.layout().baseline.data;
  const mockLayoutId = LayoutBuilder.layoutId();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCurrentLayoutActions as jest.Mock).mockReturnValue({
      getCurrentLayoutState: mockGetCurrentLayoutState,
    });
    (useCurrentLayoutSelector as jest.Mock).mockImplementation((selector) => {
      if (selector === selectLayoutData) {
        return mockLayoutData;
      }
      if (selector === selectLayoutId) {
        return mockLayoutId;
      }
      return undefined;
    });
    (useLayoutManager as jest.Mock).mockReturnValue(mockLayoutManager);
    localStorage.clear();
  });

  function renderComponent() {
    const component = (
      <MockCurrentLayoutProvider>
        <CurrentLayoutLocalStorageSyncAdapter />;
      </MockCurrentLayoutProvider>
    );
    const renderObj = render(component);

    return {
      ...renderObj,
      rerender: () => {
        renderObj.rerender(component);
      },
    };
  }

  it("saves layout data to localStorage when it changes", async () => {
    // Given
    renderComponent();

    // When
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300)); // Wait for debounce
    });

    // Then
    const storedData = localStorage.getItem(LOCAL_STORAGE_STUDIO_LAYOUT_KEY);
    expect(storedData).toBe(JSON.stringify(mockLayoutData));
  });

  it("sends new layout data to layoutManager when the layout has been edited", async () => {
    // Given — layout state reports edited: true (user made a change)
    const modifiedData = { ...mockLayoutData, modified: true };
    mockGetCurrentLayoutState.mockReturnValue({
      selectedLayout: { id: mockLayoutId, data: modifiedData, edited: true },
    });

    (useCurrentLayoutSelector as jest.Mock).mockImplementation((selector) => {
      if (selector === selectLayoutData) {
        return modifiedData;
      }
      if (selector === selectLayoutId) {
        return mockLayoutId;
      }
      return undefined;
    });

    // When
    renderComponent();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300)); // Wait for debounce
    });

    // Then - updateLayout is called because edited: true
    expect(mockLayoutManager.updateLayout).toHaveBeenCalledWith({
      id: mockLayoutId,
      data: modifiedData,
    });
  });

  it("does not send layout data to layoutManager when the layout has not been edited", async () => {
    // Given — layout state has no edited flag (e.g. initial load or panel init side-effects)
    mockGetCurrentLayoutState.mockReturnValue({
      selectedLayout: { id: mockLayoutId, data: mockLayoutData },
    });

    // When
    renderComponent();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300)); // Wait for debounce
    });

    // Then - updateLayout is NOT called because edited is falsy
    expect(mockLayoutManager.updateLayout).not.toHaveBeenCalled();
  });
});
