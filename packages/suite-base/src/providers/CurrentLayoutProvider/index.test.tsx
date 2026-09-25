/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react";
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
import { RemoteLayoutFavoritesStorageContext } from "@lichtblick/suite-base/context/RemoteLayoutFavoritesStorageContext";
import {
  UserProfileStorage,
  UserProfileStorageContext,
} from "@lichtblick/suite-base/context/UserProfileStorageContext";
import AppParametersProvider from "@lichtblick/suite-base/providers/AppParametersProvider";
import CurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider";
import {
  BUSY_POLLING_INTERVAL_MS,
  BUSY_POLLING_TIMEOUT_MS,
  MAX_SUPPORTED_LAYOUT_VERSION,
} from "@lichtblick/suite-base/providers/CurrentLayoutProvider/constants";
import { ILayoutManager } from "@lichtblick/suite-base/services/ILayoutManager";
import { IRemoteLayoutFavoritesStorage } from "@lichtblick/suite-base/services/IRemoteLayoutFavoritesStorage";
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
  return {
    supportsSharing: false,
    supportsSyncing: false,
    isBusy: jest.fn().mockReturnValue(false),
    isOnline: false,
    error: undefined,
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
  mockRemoteLayoutFavorites,
}: {
  mockLayoutManager: ILayoutManager;
  mockUserProfile: UserProfileStorage;
  mockAppParameters?: Record<string, string>;
  mockRemoteLayoutFavorites?: IRemoteLayoutFavoritesStorage;
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
                  <RemoteLayoutFavoritesStorageContext.Provider value={mockRemoteLayoutFavorites}>
                    <CurrentLayoutProvider loaders={[]}>
                      {children}
                      <CurrentLayoutSyncAdapter />
                    </CurrentLayoutProvider>
                  </RemoteLayoutFavoritesStorageContext.Provider>
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

    const { result, all } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(async () => {
      await result.current.childMounted;
    });

    const selectedLayout = all.find((item) => item.layoutState.selectedLayout?.id)?.layoutState
      .selectedLayout?.id;

    expect(selectedLayout).toBeDefined();
    expect(selectedLayout).toBe("layout2");
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

    const { result, all } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(async () => {
      await result.current.childMounted;
    });

    const selectedLayout = all.find((item) => item.layoutState.selectedLayout?.id)?.layoutState
      .selectedLayout?.id;

    expect(selectedLayout).toBeDefined();
    expect(selectedLayout).toBe("layout2");
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

    const { result, all } = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(async () => {
      await result.current.childMounted;
    });

    const selectedLayout = all.find((item) => item.layoutState.selectedLayout?.id)?.layoutState
      .selectedLayout?.id;

    expect(selectedLayout).toBeDefined();
    expect(selectedLayout).toBe("layout3");
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

    function makeMockRemoteLayoutFavorites(ids: string[]) {
      return {
        getFavoriteLayoutIds: jest.fn().mockResolvedValue(ids),
        addFavoriteLayout: jest.fn(),
        removeFavoriteLayout: jest.fn(),
      };
    }

    async function renderAndGetSelectedLayoutId(
      mockRemoteLayoutFavorites?: IRemoteLayoutFavoritesStorage,
    ) {
      mockLayoutManager.getLayouts.mockResolvedValue(layouts);
      mockLayoutManager.getLayout.mockImplementation(async (id: string) => {
        const layout = layouts.find((item) => item.id === id);
        return layout && { ...layout, baseline: { data: TEST_LAYOUT } };
      });
      const { result, all } = renderTest({
        mockLayoutManager,
        mockUserProfile,
        mockRemoteLayoutFavorites,
      });
      await act(async () => {
        await result.current.childMounted;
      });
      return all.find((item) => item.layoutState.selectedLayout?.id)?.layoutState.selectedLayout
        ?.id;
    }

    it("selects the favorite personal layout instead of the last selected layout", async () => {
      // Given a last selected layout and a favorite personal layout
      mockUserProfile.getUserProfile.mockResolvedValue({
        currentLayoutId: "shared-c",
        favoriteLayoutIds: ["personal-b"],
      });

      // When the app opens
      const selectedLayoutId = await renderAndGetSelectedLayoutId();

      // Then the favorite layout is selected, without replacing the last selected layout
      expect(selectedLayoutId).toBe("personal-b");
      expect(mockUserProfile.setUserProfile).not.toHaveBeenCalled();
    });

    it("selects the favorite shared layout", async () => {
      // Given a favorite shared layout
      mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "personal-a" });

      // When the app opens
      const selectedLayoutId = await renderAndGetSelectedLayoutId(
        makeMockRemoteLayoutFavorites(["remote-d"]),
      );

      // Then the favorite shared layout is selected
      expect(selectedLayoutId).toBe("shared-d");
    });

    it("prefers the favorite shared layout over the favorite personal layout", async () => {
      // Given a favorite personal layout and a favorite shared layout
      mockUserProfile.getUserProfile.mockResolvedValue({
        currentLayoutId: undefined,
        favoriteLayoutIds: ["personal-a"],
      });

      // When the app opens
      const selectedLayoutId = await renderAndGetSelectedLayoutId(
        makeMockRemoteLayoutFavorites(["remote-d"]),
      );

      // Then the favorite shared layout is selected
      expect(selectedLayoutId).toBe("shared-d");
    });

    it("selects the first favorite in alphabetic order when several exist", async () => {
      // Given several favorite shared layouts
      mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: undefined });

      // When the app opens
      const selectedLayoutId = await renderAndGetSelectedLayoutId(
        makeMockRemoteLayoutFavorites(["remote-d", "remote-c"]),
      );

      // Then the first one in the layout list is selected
      expect(selectedLayoutId).toBe("shared-c");
    });

    it("falls back to the favorite personal layout when remote favorites cannot be loaded", async () => {
      // Given remote favorites that fail to load and a favorite personal layout
      mockUserProfile.getUserProfile.mockResolvedValue({
        currentLayoutId: undefined,
        favoriteLayoutIds: ["personal-b"],
      });
      const mockRemoteLayoutFavorites = makeMockRemoteLayoutFavorites([]);
      mockRemoteLayoutFavorites.getFavoriteLayoutIds.mockRejectedValue(new Error("offline"));

      // When the app opens
      const selectedLayoutId = await renderAndGetSelectedLayoutId(mockRemoteLayoutFavorites);

      // Then the favorite personal layout is selected and the failure is logged
      expect(selectedLayoutId).toBe("personal-b");
      expect(console.warn).toHaveBeenCalledWith(
        "Failed to load favorite shared layouts",
        expect.any(Error),
      );
    });

    it("keeps the layout from app parameters over favorites", async () => {
      // Given a favorite layout and a layout requested through app parameters
      mockUserProfile.getUserProfile.mockResolvedValue({
        currentLayoutId: undefined,
        favoriteLayoutIds: ["personal-b"],
      });
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
