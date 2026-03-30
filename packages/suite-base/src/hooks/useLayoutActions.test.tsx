/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";

import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { LayoutSetupOptions } from "@lichtblick/suite-base/hooks/types";
import { useConfirm } from "@lichtblick/suite-base/hooks/useConfirm";
import { useLayoutActions } from "@lichtblick/suite-base/hooks/useLayoutActions";
import { useLayoutNavigation } from "@lichtblick/suite-base/hooks/useLayoutNavigation";
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

jest.mock("@lichtblick/suite-base/hooks/useLayoutNavigation", () => ({
  useLayoutNavigation: jest.fn().mockReturnValue({
    onSelectLayout: jest.fn(),
  }),
}));

jest.mock("@lichtblick/suite-base/hooks/useConfirm", () => ({
  useConfirm: jest.fn().mockReturnValue([jest.fn().mockResolvedValue("ok"), undefined]),
}));

function setup(options: Partial<LayoutSetupOptions> = {}) {
  const {
    state = {
      busy: false,
      error: undefined,
      online: true,
      lastSelectedId: undefined,
      multiAction: undefined,
      selectedIds: [] as string[],
    },
    dispatch = jest.fn(),
  } = options;

  const { result } = renderHook(() => useLayoutActions({ state, dispatch }));
  return { result, dispatch };
}

describe("useLayoutActions", () => {
  let analyticsMock: any;
  let setSelectedLayoutIdMock: jest.Mock;
  let onSelectLayoutMock: jest.Mock;
  let confirmMock: jest.Mock;
  const mockLayoutManager = new MockLayoutManager();

  beforeEach(() => {
    mockLayoutManager.updateLayout = jest.fn().mockResolvedValue(undefined);
    mockLayoutManager.deleteLayout = jest.fn().mockResolvedValue(undefined);
    mockLayoutManager.overwriteLayout = jest.fn().mockResolvedValue(undefined);
    mockLayoutManager.revertLayout = jest.fn().mockResolvedValue(undefined);
    mockLayoutManager.getLayouts = jest.fn().mockResolvedValue([]);
    analyticsMock = { logEvent: jest.fn() };
    setSelectedLayoutIdMock = jest.fn();
    onSelectLayoutMock = jest.fn();
    confirmMock = jest.fn().mockResolvedValue("ok");

    (useLayoutManager as jest.Mock).mockReturnValue(mockLayoutManager);
    (useAnalytics as jest.Mock).mockReturnValue(analyticsMock);
    (useCurrentLayoutActions as jest.Mock).mockReturnValue({
      setSelectedLayoutId: setSelectedLayoutIdMock,
    });
    (useLayoutNavigation as jest.Mock).mockReturnValue({
      onSelectLayout: onSelectLayoutMock,
    });
    (useConfirm as jest.Mock).mockReturnValue([confirmMock, undefined]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onRenameLayout", () => {
    it("calls updateLayout, setSelectedLayoutId, and logs event", async () => {
      const { result } = setup();
      const mockLayout = LayoutBuilder.layout({ permission: "CREATOR_WRITE" });
      const newName = BasicBuilder.string();

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

  describe("onDuplicateLayout", () => {
    it("saves new layout, selects it, and logs event", async () => {
      const newLayout = LayoutBuilder.layout();
      mockLayoutManager.saveNewLayout = jest.fn().mockResolvedValue(newLayout);

      const { result } = setup();
      const mockLayout = LayoutBuilder.layout({ permission: "CREATOR_WRITE" });

      await act(async () => {
        await result.current.onDuplicateLayout(mockLayout);
      });

      expect(mockLayoutManager.saveNewLayout).toHaveBeenCalledWith({
        name: `${mockLayout.name} copy`,
        data: mockLayout.working?.data ?? mockLayout.baseline.data,
        permission: "CREATOR_WRITE",
      });
      expect(onSelectLayoutMock).toHaveBeenCalledWith(newLayout);
      expect(analyticsMock.logEvent).toHaveBeenCalledWith(AppEvent.LAYOUT_DUPLICATE, {
        permission: mockLayout.permission,
      });
    });

    it("dispatches queue-multi-action when multiple layouts are selected", async () => {
      const { result, dispatch } = setup({
        state: {
          busy: false,
          error: undefined,
          online: true,
          lastSelectedId: undefined,
          multiAction: undefined,
          selectedIds: ["id1", "id2"],
        },
      });

      await act(async () => {
        await result.current.onDuplicateLayout(LayoutBuilder.layout());
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: "queue-multi-action",
        action: "duplicate",
      });
      expect(mockLayoutManager.saveNewLayout).not.toHaveBeenCalled();
      expect(onSelectLayoutMock).not.toHaveBeenCalled();
      expect(analyticsMock.logEvent).not.toHaveBeenCalled();
    });
  });

  describe("onDeleteLayout", () => {
    it("deletes the layout and logs event", async () => {
      const { result } = setup();
      const mockLayout = LayoutBuilder.layout({ permission: "CREATOR_WRITE" });

      await act(async () => {
        await result.current.onDeleteLayout(mockLayout);
      });

      expect(mockLayoutManager.deleteLayout).toHaveBeenCalledWith({ id: mockLayout.id });
      expect(analyticsMock.logEvent).toHaveBeenCalledWith(AppEvent.LAYOUT_DELETE, {
        permission: mockLayout.permission,
      });
    });

    it("dispatches queue-multi-action when multiple layouts are selected", async () => {
      const { result, dispatch } = setup({
        state: {
          busy: false,
          error: undefined,
          online: true,
          lastSelectedId: undefined,
          multiAction: undefined,
          selectedIds: ["id1", "id2"],
        },
      });

      await act(async () => {
        await result.current.onDeleteLayout(LayoutBuilder.layout());
      });

      expect(dispatch).toHaveBeenCalledWith({ type: "queue-multi-action", action: "delete" });
      expect(mockLayoutManager.deleteLayout).not.toHaveBeenCalled();
      expect(onSelectLayoutMock).not.toHaveBeenCalled();
      expect(analyticsMock.logEvent).not.toHaveBeenCalled();
    });
  });

  describe("onRevertLayout", () => {
    it("reverts the layout and logs event", async () => {
      const { result } = setup();
      const mockLayout = LayoutBuilder.layout({ permission: "CREATOR_WRITE" });

      await act(async () => {
        await result.current.onRevertLayout(mockLayout);
      });

      expect(mockLayoutManager.revertLayout).toHaveBeenCalledWith({ id: mockLayout.id });
      expect(analyticsMock.logEvent).toHaveBeenCalledWith(AppEvent.LAYOUT_REVERT, {
        permission: mockLayout.permission,
      });
    });

    it("dispatches queue-multi-action when multiple layouts are selected", async () => {
      const { result, dispatch } = setup({
        state: {
          busy: false,
          error: undefined,
          online: true,
          lastSelectedId: undefined,
          multiAction: undefined,
          selectedIds: ["id1", "id2"],
        },
      });

      await act(async () => {
        await result.current.onRevertLayout(LayoutBuilder.layout());
      });

      expect(dispatch).toHaveBeenCalledWith({ type: "queue-multi-action", action: "revert" });
      expect(mockLayoutManager.revertLayout).not.toHaveBeenCalled();
      expect(onSelectLayoutMock).not.toHaveBeenCalled();
      expect(analyticsMock.logEvent).not.toHaveBeenCalled();
    });
  });

  describe("onOverwriteLayout", () => {
    it("overwrites a personal layout without confirmation and logs event", async () => {
      const { result } = setup();
      const mockLayout = LayoutBuilder.layout({ permission: "CREATOR_WRITE" });

      await act(async () => {
        await result.current.onOverwriteLayout(mockLayout);
      });

      expect(confirmMock).not.toHaveBeenCalled();
      expect(mockLayoutManager.overwriteLayout).toHaveBeenCalledWith({ id: mockLayout.id });
      expect(analyticsMock.logEvent).toHaveBeenCalledWith(AppEvent.LAYOUT_OVERWRITE, {
        permission: mockLayout.permission,
      });
    });

    it("asks confirmation before overwriting a shared layout and proceeds on ok", async () => {
      const { result } = setup();
      const mockLayout = LayoutBuilder.layout({ permission: "ORG_READ" });

      await act(async () => {
        await result.current.onOverwriteLayout(mockLayout);
      });

      expect(confirmMock).toHaveBeenCalled();
      expect(mockLayoutManager.overwriteLayout).toHaveBeenCalledWith({ id: mockLayout.id });
    });

    it("cancels overwrite of shared layout when user dismisses confirmation", async () => {
      confirmMock.mockResolvedValue("cancel");
      const { result } = setup();
      const mockLayout = LayoutBuilder.layout({ permission: "ORG_READ" });

      await act(async () => {
        await result.current.onOverwriteLayout(mockLayout);
      });

      expect(mockLayoutManager.overwriteLayout).not.toHaveBeenCalled();
      expect(analyticsMock.logEvent).not.toHaveBeenCalled();
    });

    it("dispatches queue-multi-action when multiple layouts are selected", async () => {
      const { result, dispatch } = setup({
        state: {
          busy: false,
          error: undefined,
          online: true,
          lastSelectedId: undefined,
          multiAction: undefined,
          selectedIds: ["id1", "id2"],
        },
      });

      await act(async () => {
        await result.current.onOverwriteLayout(LayoutBuilder.layout());
      });

      expect(dispatch).toHaveBeenCalledWith({ type: "queue-multi-action", action: "save" });
      expect(mockLayoutManager.overwriteLayout).not.toHaveBeenCalled();
    });
  });
});
