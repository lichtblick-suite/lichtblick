/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";
import { MouseEvent } from "react";

import { useLayoutBrowserReducer } from "@lichtblick/suite-base/components/LayoutBrowser/reducer";
import { LayoutSelectionState } from "@lichtblick/suite-base/components/LayoutBrowser/types";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";

import { useLayoutNavigation } from "./useLayoutNavigation";

type SetupOptions = {
  menuClose?: jest.Mock;
  layoutProps?: Partial<Layout>;
};

jest.mock("@lichtblick/suite-base/hooks/useCallbackWithToast", () => ({
  __esModule: true,
  default: (fn: unknown) => fn,
}));

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

jest.mock("@lichtblick/suite-base/components/LayoutBrowser/reducer", () => ({
  useLayoutBrowserReducer: jest.fn(),
}));

describe("useLayoutNavigation", () => {
  const currentLayoutId = LayoutBuilder.layoutId("current-layout");
  const otherLayoutId = LayoutBuilder.layoutId("other-layout");

  const defaultState: LayoutSelectionState = {
    busy: false,
    error: undefined,
    online: true,
    lastSelectedId: currentLayoutId,
    multiAction: undefined,
    selectedIds: [],
  };

  let analyticsMock: { logEvent: jest.Mock };
  let setSelectedLayoutIdMock: jest.Mock;
  let dispatchMock: jest.Mock;
  let mockLayoutManager: {
    isBusy: jest.Mock;
    error: undefined;
    isOnline: boolean;
    getLayouts: jest.Mock;
    supportsSharing: boolean;
  };

  function setup(options: SetupOptions = {}) {
    const { menuClose, layoutProps } = options;
    const layout = LayoutBuilder.layout({ ...layoutProps });
    const { result } = renderHook(() => {
      if (menuClose) {
        return useLayoutNavigation(menuClose);
      }
      return useLayoutNavigation();
    });

    return { result, layout };
  }

  beforeEach(() => {
    analyticsMock = { logEvent: jest.fn() };
    setSelectedLayoutIdMock = jest.fn();
    dispatchMock = jest.fn();
    mockLayoutManager = {
      isBusy: jest.fn().mockReturnValue(false),
      error: undefined,
      isOnline: true,
      getLayouts: jest.fn().mockResolvedValue([]),
      supportsSharing: false,
    };

    (useAnalytics as jest.Mock).mockReturnValue(analyticsMock);
    (useCurrentLayoutActions as jest.Mock).mockReturnValue({
      setSelectedLayoutId: setSelectedLayoutIdMock,
    });
    (useCurrentLayoutSelector as jest.Mock).mockReturnValue(currentLayoutId);
    (useLayoutManager as jest.Mock).mockReturnValue(mockLayoutManager);
    (useLayoutBrowserReducer as jest.Mock).mockReturnValue([defaultState, dispatchMock]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onSelectLayout without modifier keys", () => {
    it("calls setSelectedLayoutId and dispatches select-id with the layout id", async () => {
      const { result, layout } = setup();

      await act(async () => {
        await result.current.onSelectLayout(layout);
      });

      expect(setSelectedLayoutIdMock).toHaveBeenCalledWith(layout.id);
      expect(dispatchMock).toHaveBeenCalledWith({ type: "select-id", id: layout.id });
    });

    it("calls menuClose when provided", async () => {
      const menuClose = jest.fn();
      const { result, layout } = setup({ menuClose });

      await act(async () => {
        await result.current.onSelectLayout(layout);
      });

      expect(menuClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("analytics logging", () => {
    it("logs LAYOUT_SELECT event when selectedViaClick is true", async () => {
      const { result, layout } = setup({ layoutProps: { permission: "CREATOR_WRITE" } });

      await act(async () => {
        await result.current.onSelectLayout(layout, { selectedViaClick: true });
      });

      expect(analyticsMock.logEvent).toHaveBeenCalledWith(AppEvent.LAYOUT_SELECT, {
        permission: layout.permission,
      });
    });

    it("does not log event when selectedViaClick is false", async () => {
      const { result, layout } = setup();

      await act(async () => {
        await result.current.onSelectLayout(layout, { selectedViaClick: false });
      });

      expect(analyticsMock.logEvent).not.toHaveBeenCalled();
    });
  });

  describe("onSelectLayout with modifier keys", () => {
    it("dispatches select-id with modKey=true when ctrlKey is pressed on a different layout", async () => {
      const { result, layout } = setup({ layoutProps: { id: otherLayoutId } });

      await act(async () => {
        await result.current.onSelectLayout(layout, {
          event: { ctrlKey: true, metaKey: false, shiftKey: false } as MouseEvent,
        });
      });

      expect(setSelectedLayoutIdMock).not.toHaveBeenCalled();
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "select-id",
          id: layout.id,
          modKey: true,
          shiftKey: false,
        }),
      );
    });

    it("dispatches select-id with modKey=true when metaKey is pressed on a different layout", async () => {
      const { result, layout } = setup({ layoutProps: { id: otherLayoutId } });

      await act(async () => {
        await result.current.onSelectLayout(layout, {
          event: { ctrlKey: false, metaKey: true, shiftKey: false } as MouseEvent,
        });
      });

      expect(setSelectedLayoutIdMock).not.toHaveBeenCalled();
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "select-id",
          id: layout.id,
          modKey: true,
          shiftKey: false,
        }),
      );
    });

    it("dispatches select-id with shiftKey=true when shiftKey is pressed on a different layout", async () => {
      const { result, layout } = setup({ layoutProps: { id: otherLayoutId } });

      await act(async () => {
        await result.current.onSelectLayout(layout, {
          event: { ctrlKey: false, metaKey: false, shiftKey: true } as MouseEvent,
        });
      });

      expect(setSelectedLayoutIdMock).not.toHaveBeenCalled();
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "select-id",
          id: layout.id,
          modKey: false,
          shiftKey: true,
        }),
      );
    });

    it("does not call menuClose when a modifier key is pressed", async () => {
      const menuClose = jest.fn();
      const { result, layout } = setup({ menuClose, layoutProps: { id: otherLayoutId } });

      await act(async () => {
        await result.current.onSelectLayout(layout, {
          event: { ctrlKey: true, metaKey: false, shiftKey: false } as MouseEvent,
        });
      });

      expect(menuClose).not.toHaveBeenCalled();
    });

    it("does nothing when modifier key is pressed but item is the current layout", async () => {
      const { result, layout } = setup({ layoutProps: { id: currentLayoutId } });

      await act(async () => {
        await result.current.onSelectLayout(layout, {
          event: { ctrlKey: true, metaKey: false, shiftKey: false } as MouseEvent,
        });
      });

      expect(setSelectedLayoutIdMock).not.toHaveBeenCalled();
      expect(dispatchMock).not.toHaveBeenCalled();
    });

    it("first dispatches currentLayoutId then the new id when selectedIds is empty and ctrlKey is pressed", async () => {
      const { result, layout } = setup({ layoutProps: { id: otherLayoutId } });

      await act(async () => {
        await result.current.onSelectLayout(layout, {
          event: { ctrlKey: true, metaKey: false, shiftKey: false } as MouseEvent,
        });
      });

      expect(dispatchMock).toHaveBeenCalledTimes(2);
      expect(dispatchMock).toHaveBeenNthCalledWith(1, {
        type: "select-id",
        id: currentLayoutId,
      });
      expect(dispatchMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: "select-id", id: layout.id }),
      );
    });

    it("does not add current layout to selection when selectedIds is already populated", async () => {
      (useLayoutBrowserReducer as jest.Mock).mockReturnValue([
        { ...defaultState, selectedIds: ["already-selected"] },
        dispatchMock,
      ]);
      const { result, layout } = setup({ layoutProps: { id: otherLayoutId } });

      await act(async () => {
        await result.current.onSelectLayout(layout, {
          event: { ctrlKey: true, metaKey: false, shiftKey: false } as MouseEvent,
        });
      });

      expect(dispatchMock).toHaveBeenCalledTimes(1);
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "select-id", id: layout.id }),
      );
    });

    it("does not dispatch currentLayoutId first when currentLayoutId is undefined", async () => {
      (useCurrentLayoutSelector as jest.Mock).mockReturnValue(undefined);
      const { result, layout } = setup({ layoutProps: { id: otherLayoutId } });

      await act(async () => {
        await result.current.onSelectLayout(layout, {
          event: { ctrlKey: true, metaKey: false, shiftKey: false } as MouseEvent,
        });
      });

      expect(dispatchMock).toHaveBeenCalledTimes(1);
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: "select-id", id: layout.id }),
      );
    });
  });
});
