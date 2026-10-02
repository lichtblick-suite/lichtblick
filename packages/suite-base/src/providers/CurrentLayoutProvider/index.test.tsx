/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook, waitFor } from "@testing-library/react";
import { SnackbarProvider, useSnackbar } from "notistack";
import { useEffect } from "react";

import { Condvar } from "@lichtblick/den/async";
import { CurrentLayoutSyncAdapter } from "@lichtblick/suite-base/components/CurrentLayoutSyncAdapter";
import {
  CurrentLayoutActions,
  LayoutData,
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import LayoutManagerContext from "@lichtblick/suite-base/context/LayoutManagerContext";
import {
  UserProfileStorage,
  UserProfileStorageContext,
} from "@lichtblick/suite-base/context/UserProfileStorageContext";
import AppParametersProvider from "@lichtblick/suite-base/providers/AppParametersProvider";
import CurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider";
import {
  BUSY_POLLING_INTERVAL_MS,
  BUSY_POLLING_TIMEOUT_MS,
  FAVORITES_TIMEOUT_MS,
  MAX_SUPPORTED_LAYOUT_VERSION,
} from "@lichtblick/suite-base/providers/CurrentLayoutProvider/constants";
import { ILayoutManager, LayoutFavorites } from "@lichtblick/suite-base/services/ILayoutManager";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("notistack", () => ({
  ...jest.requireActual("notistack"),
  useSnackbar: jest.fn().mockReturnValue({
    enqueueSnackbar: jest.fn(),
  }),
}));

const TEST_LAYOUT: LayoutData = {
  layout: "ExamplePanel!1",
  configById: {},
  globalVariables: {},
  userNodes: {},
  playbackConfig: {
    speed: 0.2,
  },
};

function mockThrow(name: string) {
  return () => {
    throw new Error(`Unexpected mock function call ${name}`);
  };
}

function makeMockLayoutManager() {
  const favorites: LayoutFavorites = { personal: new Set(), shared: new Set() };
  return {
    supportsSharing: false,
    supportsSyncing: false,
    isBusy: jest.fn().mockReturnValue(false),
    isOnline: false,
    error: undefined,
    favorites,
    on: jest.fn(),
    off: jest.fn(),
    setError: jest.fn(),
    setOnline: jest.fn(),
    getLayouts: jest.fn(),
    getLayout: jest.fn(),
    saveNewLayout: jest.fn().mockImplementation(mockThrow("saveNewLayout")),
    updateLayout: jest.fn().mockImplementation(mockThrow("updateLayout")),
    deleteLayout: jest.fn().mockImplementation(mockThrow("deleteLayout")),
    overwriteLayout: jest.fn().mockImplementation(mockThrow("overwriteLayout")),
    revertLayout: jest.fn().mockImplementation(mockThrow("revertLayout")),
    makePersonalCopy: jest.fn().mockImplementation(mockThrow("makePersonalCopy")),
    getFavorites: jest.fn().mockResolvedValue(favorites),
    canFavorite: jest.fn().mockReturnValue(false),
    setFavorite: jest.fn().mockImplementation(mockThrow("setFavorite")),
  };
}
function makeMockUserProfile() {
  return {
    getUserProfile: jest.fn().mockImplementation(mockThrow("getUserProfile")),
    setUserProfile: jest.fn().mockImplementation(mockThrow("setUserProfile")),
  };
}

function renderTest({
  mockLayoutManager,
  mockUserProfile,
  mockAppParameters = {},
}: {
  mockLayoutManager: ILayoutManager;
  mockUserProfile: UserProfileStorage;
  mockAppParameters?: Record<string, string>;
}) {
  const childMounted = new Condvar();
  const childMountedWait = childMounted.wait();
  const all: Array<{
    actions: CurrentLayoutActions;
    layoutState: LayoutState;
    childMounted: Promise<void>;
  }> = [];
  const { result } = renderHook(
    () => {
      const value = {
        actions: useCurrentLayoutActions(),
        layoutState: useCurrentLayoutSelector((state) => state),
        childMounted: childMountedWait,
      };
      all.push(value);
      return value;
    },
    {
      wrapper: function Wrapper({ children }) {
        useEffect(() => {
          childMounted.notifyAll();
        }, []);
        return (
          <AppParametersProvider appParameters={mockAppParameters}>
            <SnackbarProvider>
              <LayoutManagerContext.Provider value={mockLayoutManager}>
                <UserProfileStorageContext.Provider value={mockUserProfile}>
                  <CurrentLayoutProvider loaders={[]}>
                    {children}
                    <CurrentLayoutSyncAdapter />
                  </CurrentLayoutProvider>
                </UserProfileStorageContext.Provider>
              </LayoutManagerContext.Provider>
            </SnackbarProvider>
          </AppParametersProvider>
        );
      },
    },
  );
  return { result, all };
}

describe("CurrentLayoutProvider", () => {
  const mockLayoutManager = makeMockLayoutManager();
  const mockUserProfile = makeMockUserProfile();

  beforeEach(() => {
    // Default mocks
    mockLayoutManager.getLayout.mockImplementation(async () => undefined);
    mockLayoutManager.getLayouts.mockImplementation(() => []);
    mockLayoutManager.getFavorites.mockResolvedValue({ personal: new Set(), shared: new Set() });
    mockLayoutManager.favorites = { personal: new Set(), shared: new Set() };
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: undefined });
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  it("uses currentLayoutId from UserProfile to load from LayoutStorage", async () => {
    const expectedState: LayoutData = {
      layout: "Foo!bar",
      configById: { "Foo!bar": { setting: 1 } },
      globalVariables: { var: "hello" },
      userNodes: { node1: { name: "node", sourceCode: "node()" } },
      playbackConfig: { speed: 0.1 },
    };
    const condvar = new Condvar();
    const layoutStorageGetCalledWait = condvar.wait();

    mockLayoutManager.getLayouts.mockImplementation(async () => {
      return [
        {
          id: "example",
          name: "Example layout",
          data: { data: expectedState },
          permission: "CREATOR_WRITE",
        },
      ];
    });

    mockLayoutManager.getLayout.mockImplementation(async () => {
      condvar.notifyAll();
      return {
        id: "example",
        name: "Example layout",
        baseline: { updatedAt: new Date(10).toISOString(), data: expectedState },
      };
    });

    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const { all } = renderTest({ mockLayoutManager, mockUserProfile });
    await act(async () => {
      await layoutStorageGetCalledWait;
    });

    expect(mockLayoutManager.getLayouts).toHaveBeenCalled();
    expect(all.map((item) => (item instanceof Error ? undefined : item.layoutState))).toEqual([
      { selectedLayout: undefined },
      {
        selectedLayout: {
          loading: false,
          id: "example",
          data: expectedState,
          name: "Example layout",
        },
      },
    ]);
  });

  it("refuses to load an incompatible layout", async () => {
    const expectedState: LayoutData = {
      layout: "Foo!bar",
      configById: { "Foo!bar": { setting: 1 } },
      globalVariables: { var: "hello" },
      userNodes: { node1: { name: "node", sourceCode: "node()" } },
      playbackConfig: { speed: 0.1 },
      version: MAX_SUPPORTED_LAYOUT_VERSION + 1,
    };

    const condvar = new Condvar();
    const layoutStorageGetCalledWait = condvar.wait();

    mockLayoutManager.getLayouts.mockImplementation(async () => {
      return [
        {
          id: "example",
          name: "Example layout",
          data: { data: expectedState },
          permission: "CREATOR_WRITE",
        },
      ];
    });

    mockLayoutManager.getLayout.mockImplementation(async () => {
      condvar.notifyAll();
      return {
        id: "example",
        name: "Example layout",
        baseline: { updatedAt: new Date(10).toISOString(), data: expectedState },
      };
    });

    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const { all } = renderTest({ mockLayoutManager, mockUserProfile });
    await act(async () => {
      await layoutStorageGetCalledWait;
    });

    expect(mockLayoutManager.getLayouts).toHaveBeenCalled();
    expect(all.map((item) => (item instanceof Error ? undefined : item.layoutState))).toEqual([
      { selectedLayout: undefined },
      { selectedLayout: undefined },
    ]);
  });

  it("keeps identity of action functions when modifying layout", async () => {
    mockLayoutManager.getLayouts.mockImplementation(async () => {
      return [
        {
          id: "example",
          name: "Test layout",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
      ];
    });

    mockLayoutManager.updateLayout.mockImplementation(async () => {
      return {
        id: "example",
        name: "Test layout",
        baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
      };
    });
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const { result } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });
    await act(async () => {
      await result.current.childMounted;
    });
    const actions = result.current.actions;
    expect(result.current.actions).toBe(actions);
    act(() => {
      result.current.actions.savePanelConfigs({
        configs: [{ id: "ExamplePanel!1", config: { foo: "bar" } }],
      });
    });

    expect(result.current.actions.savePanelConfigs).toBe(actions.savePanelConfigs);
  });

  it("selects the first layout in alphabetic order, when there is no selected layout", async () => {
    mockLayoutManager.getLayouts.mockImplementation(async () => {
      return [
        {
          id: "layout1",
          name: "LAYOUT 1",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
        {
          id: "layout2",
          name: "ABC Layout 2",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
      ];
    });

    const { result } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(async () => {
      await result.current.childMounted;
    });

    await waitFor(() => {
      expect(mockLayoutManager.getLayout).toHaveBeenCalledWith("layout2");
    });
  });

  it("selects the first org layout, when current layout is not found", async () => {
    mockLayoutManager.getLayouts.mockImplementation(async () => {
      return [
        {
          id: "layout1",
          name: "LAYOUT 1",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
        {
          id: "layout2",
          name: "ORG Layout 2",
          data: { data: TEST_LAYOUT },
          permission: "ORG_READ",
        },
      ];
    });
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "nonexistent" });

    const { result } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(async () => {
      await result.current.childMounted;
    });

    await waitFor(() => {
      expect(mockLayoutManager.getLayout).toHaveBeenCalledWith("layout2");
    });
  });

  it("selects the first org layout, if any, in alphabetic order, when there is no selected layout", async () => {
    mockLayoutManager.getLayouts.mockImplementation(async () => {
      return [
        {
          id: "layout1",
          name: "ABC Layout 1",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
        {
          id: "layout2",
          name: "DEF Layout 2",
          data: { data: TEST_LAYOUT },
          permission: "ORG_READ",
        },
        {
          id: "layout3",
          name: "ABC Layout 3",
          data: { data: TEST_LAYOUT },
          permission: "ORG_READ",
        },
      ];
    });

    const { result } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(async () => {
      await result.current.childMounted;
    });

    await waitFor(() => {
      expect(mockLayoutManager.getLayout).toHaveBeenCalledWith("layout3");
    });
  });

  it("select a layout through app parameters", async () => {
    const mockAppParameters = { defaultLayout: "LAYOUT 2" };
    mockLayoutManager.getLayouts.mockImplementation(async () => {
      return [
        {
          id: "layout1",
          name: "LAYOUT 1",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
        {
          id: "layout2",
          name: "LAYOUT 2",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
        {
          id: "layout3",
          name: "ABC Layout 3",
          data: { data: TEST_LAYOUT },
          permission: "ORG_READ",
        },
      ];
    });

    const { result, all } = renderTest({
      mockLayoutManager,
      mockUserProfile,
      mockAppParameters,
    });

    await act(async () => {
      await result.current.childMounted;
    });

    const selectedLayout = all.find((item) => item.layoutState.selectedLayout?.id)?.layoutState
      .selectedLayout?.id;

    expect(selectedLayout).toBeDefined();
    expect(selectedLayout).toBe("layout2");
    // A ?layout= override is session-only and must not be persisted to the user profile.
    expect(mockUserProfile.setUserProfile).not.toHaveBeenCalled();
  });

  it("prefers the organizational layout when the app parameter name matches multiple layouts", async () => {
    const mockAppParameters = { defaultLayout: "SHARED LAYOUT" };
    mockLayoutManager.getLayouts.mockImplementation(async () => {
      return [
        {
          id: "personal",
          name: "SHARED LAYOUT",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
        {
          id: "org",
          name: "SHARED LAYOUT",
          data: { data: TEST_LAYOUT },
          permission: "ORG_READ",
        },
      ];
    });

    const { result, all } = renderTest({
      mockLayoutManager,
      mockUserProfile,
      mockAppParameters,
    });

    await act(async () => {
      await result.current.childMounted;
    });

    const selectedLayout = all.find((item) => item.layoutState.selectedLayout?.id)?.layoutState
      .selectedLayout?.id;

    expect(selectedLayout).toBe("org");
  });

  it("should show a message to the user if the defaultLayout from app parameter is not found", async () => {
    const mockAppParameters = { defaultLayout: BasicBuilder.string() };

    const { result } = renderTest({
      mockLayoutManager,
      mockUserProfile,
      mockAppParameters,
    });

    await act(async () => {
      await result.current.childMounted;
    });

    const { enqueueSnackbar } = useSnackbar();

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      `The layout '${mockAppParameters.defaultLayout}' specified in the app parameters does not exist.`,
      { variant: "warning" },
    );
  });

  describe("Favorite layouts", () => {
    const layouts = [
      {
        id: "personal-a",
        name: "A personal",
        data: { data: TEST_LAYOUT },
        permission: "CREATOR_WRITE",
      },
      {
        id: "personal-b",
        name: "B personal",
        data: { data: TEST_LAYOUT },
        permission: "CREATOR_WRITE",
      },
      {
        id: "shared-c",
        externalId: "remote-c",
        name: "C shared",
        data: { data: TEST_LAYOUT },
        permission: "ORG_WRITE",
      },
      {
        id: "shared-d",
        externalId: "remote-d",
        name: "D shared",
        data: { data: TEST_LAYOUT },
        permission: "ORG_READ",
      },
    ];

    function mockFavorites({
      personal = [],
      shared = [],
    }: {
      personal?: string[];
      shared?: string[];
    }) {
      mockLayoutManager.getFavorites.mockResolvedValue({
        personal: new Set(personal),
        shared: new Set(shared),
      });
    }

    async function renderAndGetSelectedLayoutId() {
      mockLayoutManager.getLayouts.mockResolvedValue(layouts);
      mockLayoutManager.getLayout.mockImplementation(async (id: string) => {
        const layout = layouts.find((item) => item.id === id);
        return layout && { ...layout, baseline: { data: TEST_LAYOUT } };
      });
      const { result, all } = renderTest({ mockLayoutManager, mockUserProfile });
      await act(async () => {
        await result.current.childMounted;
      });
      return all.find((item) => item.layoutState.selectedLayout?.id)?.layoutState.selectedLayout
        ?.id;
    }

    it("selects the favorite personal layout instead of the last selected layout", async () => {
      // Given a last selected layout and a favorite personal layout
      mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "shared-c" });
      mockFavorites({ personal: ["personal-b"] });

      // When the app opens
      const selectedLayoutId = await renderAndGetSelectedLayoutId();

      // Then the favorite layout is selected, without replacing the last selected layout
      expect(selectedLayoutId).toBe("personal-b");
      expect(mockUserProfile.setUserProfile).not.toHaveBeenCalled();
    });

    it("selects the favorite shared layout", async () => {
      // Given a favorite shared layout
      mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "personal-a" });
      mockFavorites({ shared: ["remote-d"] });

      // When the app opens
      const selectedLayoutId = await renderAndGetSelectedLayoutId();

      // Then the favorite shared layout is selected
      expect(selectedLayoutId).toBe("shared-d");
    });

    it("prefers the favorite shared layout over the favorite personal layout", async () => {
      // Given a favorite personal layout and a favorite shared layout
      mockFavorites({ personal: ["personal-a"], shared: ["remote-d"] });

      // When the app opens
      const selectedLayoutId = await renderAndGetSelectedLayoutId();

      // Then the favorite shared layout is selected
      expect(selectedLayoutId).toBe("shared-d");
    });

    it("selects the first favorite in alphabetic order when several exist", async () => {
      // Given several favorite shared layouts
      mockFavorites({ shared: ["remote-d", "remote-c"] });

      // When the app opens
      const selectedLayoutId = await renderAndGetSelectedLayoutId();

      // Then the first one in the layout list is selected
      expect(selectedLayoutId).toBe("shared-c");
    });

    it("keeps the layout from app parameters over favorites", async () => {
      // Given a favorite layout and a layout requested through app parameters
      mockFavorites({ personal: ["personal-b"] });
      mockLayoutManager.getLayouts.mockResolvedValue(layouts);
      mockLayoutManager.getLayout.mockImplementation(async (id: string) => {
        const layout = layouts.find((item) => item.id === id);
        return layout && { ...layout, baseline: { data: TEST_LAYOUT } };
      });

      // When the app opens
      const { result, all } = renderTest({
        mockLayoutManager,
        mockUserProfile,
        mockAppParameters: { defaultLayout: "A personal" },
      });
      await act(async () => {
        await result.current.childMounted;
      });

      // Then the requested layout is selected
      expect(
        all.find((item) => item.layoutState.selectedLayout?.id)?.layoutState.selectedLayout?.id,
      ).toBe("personal-a");
    });
  });

  describe("Default layout logic", () => {
    function mockBusyTimes(times: number) {
      Array.from({ length: times }).forEach(() => {
        mockLayoutManager.isBusy.mockReturnValueOnce(true);
      });
      mockLayoutManager.isBusy.mockReturnValue(false);
    }

    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.useRealTimers();
      (console.warn as jest.Mock).mockRestore();
    });

    it("should resolve immediately if layoutManager is not busy", async () => {
      // Given/When
      mockLayoutManager.isBusy.mockReturnValue(false);

      const { result } = renderTest({ mockLayoutManager, mockUserProfile });

      await act(async () => {
        await result.current.childMounted;
      });

      // Then
      expect(mockLayoutManager.isBusy).toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(mockLayoutManager.getLayouts).toHaveBeenCalled();
    });

    it("should poll until layoutManager is not busy", async () => {
      // Given/When
      const busyCount = 3;
      mockBusyTimes(busyCount);

      const { result } = renderTest({
        mockLayoutManager,
        mockUserProfile,
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(busyCount * BUSY_POLLING_INTERVAL_MS);
        await result.current.childMounted;
      });

      // Then
      expect(mockLayoutManager.isBusy).toHaveBeenCalledTimes(4);
      expect(console.warn).not.toHaveBeenCalled();
      expect(mockLayoutManager.getLayouts).toHaveBeenCalled();
    });

    it("should not wait more than the favorites timeout and use the favorites loaded so far", async () => {
      // Given favorites that never finish loading, and a personal favorite already loaded
      mockLayoutManager.getFavorites.mockReturnValue(new Promise(() => {}));
      mockLayoutManager.favorites = { personal: new Set(["layout2"]), shared: new Set() };
      mockLayoutManager.getLayouts.mockResolvedValue([
        {
          id: "layout1",
          name: "Layout 1",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
        {
          id: "layout2",
          name: "Layout 2",
          data: { data: TEST_LAYOUT },
          permission: "CREATOR_WRITE",
        },
      ]);
      mockLayoutManager.getLayout.mockImplementation(async (id: string) => ({
        id,
        name: id,
        baseline: { data: TEST_LAYOUT },
      }));

      // When the favorites timeout elapses
      const { all } = renderTest({ mockLayoutManager, mockUserProfile });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(FAVORITES_TIMEOUT_MS + 100);
      });

      // Then the loaded favorite is selected and the delay is logged
      expect(
        all.find((item) => item.layoutState.selectedLayout?.id)?.layoutState.selectedLayout?.id,
      ).toBe("layout2");
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Favorite layouts took longer than ${FAVORITES_TIMEOUT_MS}ms`),
      );
    });

    it("should timeout after 5 seconds, log warning and continue as normal", async () => {
      mockLayoutManager.isBusy.mockReturnValue(true); // Always busy

      const { result } = renderTest({
        mockLayoutManager,
        mockUserProfile,
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(BUSY_POLLING_TIMEOUT_MS + 100);
        await result.current.childMounted;
      });

      expect(console.warn).toHaveBeenCalledWith(
        `CurrentLayoutProvider: timeout after ${BUSY_POLLING_TIMEOUT_MS}ms, continuing anyway`,
      );
      expect(mockLayoutManager.getLayouts).toHaveBeenCalled();
    });
  });

  describe("Fallback Default layout creation", () => {
    it("creates a personal Default layout when no layouts exist", async () => {
      // Given a layout manager with no existing layouts and a user profile without a selection
      const localOnlyManager = makeMockLayoutManager();
      localOnlyManager.getLayouts.mockResolvedValue([]);
      localOnlyManager.saveNewLayout.mockResolvedValue({
        id: "new-default",
        name: "Default",
        baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
      });
      mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: undefined });

      // When the provider initializes
      const { result } = renderTest({ mockLayoutManager: localOnlyManager, mockUserProfile });
      await act(async () => {
        await result.current.childMounted;
      });

      // Then a personal Default layout is created
      expect(localOnlyManager.saveNewLayout).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Default", permission: "CREATOR_WRITE" }),
      );
    });
  });
});
