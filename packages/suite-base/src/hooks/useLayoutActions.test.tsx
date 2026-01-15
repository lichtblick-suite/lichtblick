/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";

import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { useLayoutActions } from "@lichtblick/suite-base/hooks/useLayoutActions";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/suite-base/context/LayoutManagerContext", () => ({
  useLayoutManager: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/AnalyticsContext", () => ({
  useAnalytics: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutActions: jest.fn(),
  useCurrentLayoutSelector: jest.fn(),
}));

describe("useLayoutActions", () => {
  let analyticsMock: any;
  let setSelectedLayoutIdMock: any;
  const mockLayoutManager = new MockLayoutManager();

  beforeEach(() => {
    mockLayoutManager.updateLayout = jest.fn().mockResolvedValue(undefined);
    analyticsMock = {
      logEvent: jest.fn(),
    };
    setSelectedLayoutIdMock = jest.fn();

    (useLayoutManager as jest.Mock).mockReturnValue(mockLayoutManager);
    (useAnalytics as jest.Mock).mockReturnValue(analyticsMock);
    (useCurrentLayoutActions as jest.Mock).mockReturnValue({
      setSelectedLayoutId: setSelectedLayoutIdMock,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should rename the layout", async () => {
    const { result } = renderHook(() => useLayoutActions());
    const newName = BasicBuilder.string();

    const mockLayout = LayoutBuilder.layout({ permission: "CREATOR_WRITE" });

    await act(async () => {
      await result.current.onRenameLayout(mockLayout, newName);
    });

    expect(mockLayoutManager.updateLayout).toHaveBeenCalledWith({
      id: mockLayout.id,
      name: newName,
    });

    expect(setSelectedLayoutIdMock).toHaveBeenCalledWith(mockLayout.id);

    expect(analyticsMock.logEvent).toHaveBeenCalledWith(AppEvent.LAYOUT_RENAME, {
      permission: mockLayout.permission,
    });
  });
});
