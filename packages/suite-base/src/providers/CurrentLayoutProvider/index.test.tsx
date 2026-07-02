/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Mock } from "vitest";
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
import { BasicBuilder } from "@lichtblick/test-builders";

vi.mock("notistack", async () => ({
  ...(await vi.importActual("notistack")),
  useSnackbar: vi.fn().mockReturnValue({
    enqueueSnackbar: vi.fn(),
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
    isBusy: vi.fn().mockReturnValue(false),
    isOnline: false,
    error: undefined,
    on: vi.fn(),
    off: vi.fn(),
    setError: vi.fn(),
    setOnline: vi.fn(),
    getLayouts: vi.fn(),
    getLayout: vi.fn(),
    saveNewLayout: vi.fn().mockImplementation(mockThrow("saveNewLayout")),
    updateLayout: vi.fn().mockImplementation(mockThrow("updateLayout")),
    deleteLayout: vi.fn().mockImplementation(mockThrow("deleteLayout")),
    overwriteLayout: vi.fn().mockImplementation(mockThrow("overwriteLayout")),
    revertLayout: vi.fn().mockImplementation(mockThrow("revertLayout")),
    makePersonalCopy: vi.fn().mockImplementation(mockThrow("makePersonalCopy")),
  };
}
function makeMockUserProfile() {
  return {
    getUserProfile: vi.fn().mockImplementation(mockThrow("getUserProfile")),
    setUserProfile: vi.fn().mockImplementation(mockThrow("setUserProfile")),
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
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: undefined });
  });

  afterEach(() => {
    vi.clearAllMocks();
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

  describe("Default layout logic", () => {
    function mockBusyTimes(times: number) {
      Array.from({ length: times }).forEach(() => {
        mockLayoutManager.isBusy.mockReturnValueOnce(true);
      });
      mockLayoutManager.isBusy.mockReturnValue(false);
    }

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.useRealTimers();
      (console.warn as Mock).mockRestore();
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
        await vi.advanceTimersByTimeAsync(busyCount * BUSY_POLLING_INTERVAL_MS);
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
        await vi.advanceTimersByTimeAsync(BUSY_POLLING_TIMEOUT_MS + 100);
        await result.current.childMounted;
      });

      expect(console.warn).toHaveBeenCalledWith(
        `CurrentLayoutProvider: timeout after ${BUSY_POLLING_TIMEOUT_MS}ms, continuing anyway`,
      );
      expect(mockLayoutManager.getLayouts).toHaveBeenCalled();
    });
  });
});
