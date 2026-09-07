/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { ReactNode } from "react";
import { StoreApi, createStore } from "zustand";

import { WorkspaceContext, WorkspaceContextStore } from "./WorkspaceContext";
import { useWorkspaceActions } from "./useWorkspaceActions";

jest.mock("@lichtblick/suite-base/context/PlayerSelectionContext", () => ({
  usePlayerSelection: jest.fn().mockReturnValue({ availableSources: [] }),
}));

jest.mock("./useOpenFile", () => ({
  useOpenFile: jest.fn().mockReturnValue(jest.fn()),
}));

function makeInitialState(): WorkspaceContextStore {
  return {
    dialogs: {
      dataSource: { activeDataSource: undefined, item: undefined, open: false },
      preferences: { initialTab: undefined, open: false },
    },
    featureTours: { active: undefined, shown: [] },
    layoutBrowser: { expandedSections: { personal: true, shared: true } },
    playbackControls: { repeat: false, syncInstances: false },
    sidebars: {
      left: { item: "panel-settings", open: true, size: undefined },
      right: { item: undefined, open: false, size: undefined },
    },
  };
}

function renderUseWorkspaceActions(initialState?: Partial<WorkspaceContextStore>) {
  const store: StoreApi<WorkspaceContextStore> = createStore<WorkspaceContextStore>()(() => ({
    ...makeInitialState(),
    ...initialState,
  }));

  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>
  );

  const { result } = renderHook(() => useWorkspaceActions(), { wrapper });
  return { result, store };
}

describe("useWorkspaceActions", () => {
  describe("layoutBrowserActions", () => {
    it("sets personal section expanded to a direct value", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.layoutBrowserActions.setPersonalSectionExpanded(false);
      });

      // THEN
      expect(store.getState().layoutBrowser.expandedSections.personal).toBe(false);
    });

    it("sets personal section expanded using a function updater", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions({
        layoutBrowser: { expandedSections: { personal: true, shared: true } },
      });

      // WHEN
      act(() => {
        result.current.layoutBrowserActions.setPersonalSectionExpanded((old) => !old);
      });

      // THEN
      expect(store.getState().layoutBrowser.expandedSections.personal).toBe(false);
    });

    it("sets shared section expanded to a direct value", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.layoutBrowserActions.setSharedSectionExpanded(false);
      });

      // THEN
      expect(store.getState().layoutBrowser.expandedSections.shared).toBe(false);
    });

    it("sets shared section expanded using a function updater", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions({
        layoutBrowser: { expandedSections: { personal: true, shared: true } },
      });

      // WHEN
      act(() => {
        result.current.layoutBrowserActions.setSharedSectionExpanded((old) => !old);
      });

      // THEN
      expect(store.getState().layoutBrowser.expandedSections.shared).toBe(false);
    });

    it("does not affect shared section when setting personal section", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions({
        layoutBrowser: { expandedSections: { personal: true, shared: false } },
      });

      // WHEN
      act(() => {
        result.current.layoutBrowserActions.setPersonalSectionExpanded(false);
      });

      // THEN
      expect(store.getState().layoutBrowser.expandedSections.personal).toBe(false);
      expect(store.getState().layoutBrowser.expandedSections.shared).toBe(false);
    });

    it("does not affect personal section when setting shared section", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions({
        layoutBrowser: { expandedSections: { personal: false, shared: true } },
      });

      // WHEN
      act(() => {
        result.current.layoutBrowserActions.setSharedSectionExpanded(false);
      });

      // THEN
      expect(store.getState().layoutBrowser.expandedSections.personal).toBe(false);
      expect(store.getState().layoutBrowser.expandedSections.shared).toBe(false);
    });
  });

  describe("openPanelSettings", () => {
    it("sets left sidebar to panel-settings and opens it", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions({
        sidebars: {
          left: { item: "layouts", open: false, size: undefined },
          right: { item: undefined, open: false, size: undefined },
        },
      });

      // WHEN
      act(() => {
        result.current.openPanelSettings();
      });

      // THEN
      expect(store.getState().sidebars.left.item).toBe("panel-settings");
      expect(store.getState().sidebars.left.open).toBe(true);
    });
  });

  describe("openLayoutBrowser", () => {
    it("sets left sidebar item to layouts", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.openLayoutBrowser();
      });

      // THEN
      expect(store.getState().sidebars.left.item).toBe("layouts");
    });
  });

  describe("playbackControlActions", () => {
    it("toggles repeat using function updater", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.playbackControlActions.setRepeat((old) => !old);
      });

      // THEN
      expect(store.getState().playbackControls.repeat).toBe(true);
    });

    it("sets syncInstances to a direct value", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.playbackControlActions.setSyncInstances(true);
      });

      // THEN
      expect(store.getState().playbackControls.syncInstances).toBe(true);
    });
  });

  describe("featureTourActions", () => {
    it("starts a tour", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.featureTourActions.startTour("welcome");
      });

      // THEN
      expect(store.getState().featureTours.active).toBe("welcome");
    });

    it("finishes a tour and adds it to shown list", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();
      act(() => {
        result.current.featureTourActions.startTour("welcome");
      });

      // WHEN
      act(() => {
        result.current.featureTourActions.finishTour("welcome");
      });

      // THEN
      expect(store.getState().featureTours.active).toBeUndefined();
      expect(store.getState().featureTours.shown).toContain("welcome");
    });
  });

  describe("sidebarActions", () => {
    it("selects left sidebar item and opens it", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions({
        sidebars: {
          left: { item: undefined, open: false, size: undefined },
          right: { item: undefined, open: false, size: undefined },
        },
      });

      // WHEN
      act(() => {
        result.current.sidebarActions.left.selectItem("topics");
      });

      // THEN
      expect(store.getState().sidebars.left.item).toBe("topics");
      expect(store.getState().sidebars.left.open).toBe(true);
    });

    it("closes left sidebar when selecting undefined", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.sidebarActions.left.selectItem(undefined);
      });

      // THEN
      expect(store.getState().sidebars.left.open).toBe(false);
    });

    it("sets left sidebar size", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.sidebarActions.left.setSize(300);
      });

      // THEN
      expect(store.getState().sidebars.left.size).toBe(300);
    });

    it("selects right sidebar item and opens it", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions({
        sidebars: {
          left: { item: "panel-settings", open: true, size: undefined },
          right: { item: undefined, open: false, size: undefined },
        },
      });

      // WHEN
      act(() => {
        result.current.sidebarActions.right.selectItem("variables");
      });

      // THEN
      expect(store.getState().sidebars.right.item).toBe("variables");
      expect(store.getState().sidebars.right.open).toBe(true);
    });

    it("closes right sidebar when selecting undefined", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions({
        sidebars: {
          left: { item: "panel-settings", open: true, size: undefined },
          right: { item: "variables", open: true, size: undefined },
        },
      });

      // WHEN
      act(() => {
        result.current.sidebarActions.right.selectItem(undefined);
      });

      // THEN
      expect(store.getState().sidebars.right.open).toBe(false);
    });

    it("sets right sidebar size", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.sidebarActions.right.setSize(250);
      });

      // THEN
      expect(store.getState().sidebars.right.size).toBe(250);
    });
  });

  describe("dialogActions", () => {
    it("opens data source dialog", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.dialogActions.dataSource.open("start");
      });

      // THEN
      expect(store.getState().dialogs.dataSource.open).toBe(true);
      expect(store.getState().dialogs.dataSource.item).toBe("start");
    });

    it("closes data source dialog", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();
      act(() => {
        result.current.dialogActions.dataSource.open("start");
      });

      // WHEN
      act(() => {
        result.current.dialogActions.dataSource.close();
      });

      // THEN
      expect(store.getState().dialogs.dataSource.open).toBe(false);
      expect(store.getState().dialogs.dataSource.item).toBeUndefined();
    });

    it("opens preferences dialog with initial tab", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();

      // WHEN
      act(() => {
        result.current.dialogActions.preferences.open("general");
      });

      // THEN
      expect(store.getState().dialogs.preferences.open).toBe(true);
      expect(store.getState().dialogs.preferences.initialTab).toBe("general");
    });

    it("closes preferences dialog", () => {
      // GIVEN
      const { result, store } = renderUseWorkspaceActions();
      act(() => {
        result.current.dialogActions.preferences.open("general");
      });

      // WHEN
      act(() => {
        result.current.dialogActions.preferences.close();
      });

      // THEN
      expect(store.getState().dialogs.preferences.open).toBe(false);
      expect(store.getState().dialogs.preferences.initialTab).toBeUndefined();
    });
  });
});
