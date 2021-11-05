// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react-hooks";
import { useEffect } from "react";
import { ToastProvider } from "react-toast-notifications";

import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import LayoutManagerContext from "@foxglove/studio-base/context/LayoutManagerContext";
import {
  UserProfileStorage,
  UserProfileStorageContext,
} from "@foxglove/studio-base/context/UserProfileStorageContext";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import { ILayoutManager } from "@foxglove/studio-base/services/ILayoutManager";
import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import signal from "@foxglove/studio-base/util/signal";

const TEST_LAYOUT: PanelsState = {
  layout: "ExamplePanel!1",
  configById: {},
  globalVariables: {},
  userNodes: {},
  linkedGlobalVariables: [],
  playbackConfig: {
    speed: 0.2,
    messageOrder: "receiveTime",
    timeDisplayMethod: "SEC",
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
    isBusy: false,
    isOnline: false,
    on: jest.fn(/*noop*/),
    off: jest.fn(/*noop*/),
    setOnline: jest.fn(/*noop*/),
    getLayouts: jest.fn().mockImplementation(mockThrow("getLayouts")),
    getLayout: jest.fn().mockImplementation(mockThrow("getLayout")),
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
}: {
  mockLayoutManager: ILayoutManager;
  mockUserProfile: UserProfileStorage;
}) {
  const childMounted = signal();
  const { result } = renderHook(
    () => ({
      actions: useCurrentLayoutActions(),
      layoutState: useCurrentLayoutSelector((state) => state),
      childMounted,
    }),
    {
      wrapper: function Wrapper({ children }) {
        useEffect(() => childMounted.resolve(), []);
        return (
          <ToastProvider>
            <LayoutManagerContext.Provider value={mockLayoutManager}>
              <UserProfileStorageContext.Provider value={mockUserProfile}>
                <CurrentLayoutProvider>{children}</CurrentLayoutProvider>
              </UserProfileStorageContext.Provider>
            </LayoutManagerContext.Provider>
          </ToastProvider>
        );
      },
    },
  );
  return result;
}

describe("CurrentLayoutProvider", () => {
  it("uses currentLayoutId from UserProfile to load from LayoutStorage", async () => {
    const expectedState: PanelsState = {
      layout: "Foo!bar",
      configById: { "Foo!bar": { setting: 1 } },
      globalVariables: { var: "hello" },
      linkedGlobalVariables: [{ topic: "/test", markerKeyPath: [], name: "var" }],
      userNodes: { node1: { name: "node", sourceCode: "node()" } },
      playbackConfig: { speed: 0.1, messageOrder: "headerStamp", timeDisplayMethod: "TOD" },
    };
    const layoutStorageGetCalled = signal();
    const mockLayoutManager = makeMockLayoutManager();
    mockLayoutManager.getLayout.mockImplementation(async () => {
      layoutStorageGetCalled.resolve();
      return {
        id: "example",
        name: "Example layout",
        baseline: { updatedAt: new Date(10).toISOString(), data: expectedState },
      };
    });

    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const result = renderTest({ mockLayoutManager, mockUserProfile });
    await act(() => layoutStorageGetCalled);

    expect(mockLayoutManager.getLayout.mock.calls).toEqual([["example"]]);
    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.layoutState)),
    ).toEqual([
      { selectedLayout: undefined },
      { selectedLayout: { loading: true, id: "example", data: undefined } },
      { selectedLayout: { loading: false, id: "example", data: expectedState } },
    ]);
  });

  it("saves new layout selection into UserProfile", async () => {
    const mockLayoutManager = makeMockLayoutManager();
    const newLayout: Partial<PanelsState> = {
      ...TEST_LAYOUT,
      layout: "ExamplePanel!2",
    };
    mockLayoutManager.getLayout.mockImplementation(async (id: string) => {
      return id === "example"
        ? {
            id: "example",
            name: "Example layout",
            baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
          }
        : {
            id: "example2",
            name: "Example layout 2",
            baseline: { data: newLayout, updatedAt: new Date(12).toISOString() },
          };
    });

    const userProfileSetCalled = signal();
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });
    mockUserProfile.setUserProfile.mockImplementation(async () => {
      userProfileSetCalled.resolve();
    });

    const result = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(() => result.current.childMounted);
    await act(async () => result.current.actions.setSelectedLayoutId("example2" as LayoutID));
    await act(() => userProfileSetCalled);

    expect(mockUserProfile.setUserProfile.mock.calls).toEqual([[{ currentLayoutId: "example2" }]]);
    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.layoutState)),
    ).toEqual([
      { selectedLayout: undefined },
      { selectedLayout: { loading: true, id: "example", data: undefined } },
      { selectedLayout: { loading: false, id: "example", data: TEST_LAYOUT } },
      { selectedLayout: { loading: true, id: "example2", data: undefined } },
      { selectedLayout: { loading: false, id: "example2", data: newLayout } },
    ]);
  });

  it("saves layout updates into LayoutStorage", async () => {
    const layoutStoragePutCalled = signal();
    const mockLayoutManager = makeMockLayoutManager();
    mockLayoutManager.getLayout.mockImplementation(async () => {
      return {
        id: "example",
        name: "Test layout",
        baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
      };
    });

    mockLayoutManager.updateLayout.mockImplementation(async () => layoutStoragePutCalled.resolve());
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const result = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });

    await act(() => result.current.childMounted);
    act(() => result.current.actions.setPlaybackConfig({ timeDisplayMethod: "TOD" }));
    await act(() => layoutStoragePutCalled);

    const newState = {
      ...TEST_LAYOUT,
      playbackConfig: {
        ...TEST_LAYOUT.playbackConfig,
        timeDisplayMethod: "TOD",
      },
    };

    expect(mockLayoutManager.updateLayout.mock.calls).toEqual([
      [{ id: "example", data: newState }],
    ]);
    expect(
      result.all.map((item) => (item instanceof Error ? undefined : item.layoutState)),
    ).toEqual([
      { selectedLayout: undefined },
      { selectedLayout: { loading: true, id: "example", data: undefined } },
      { selectedLayout: { loading: false, id: "example", data: TEST_LAYOUT } },
      { selectedLayout: { loading: false, id: "example", data: newState } },
    ]);
  });

  it("keeps identity of action functions when modifying layout", async () => {
    const layoutStoragePutCalled = signal();
    const mockLayoutManager = makeMockLayoutManager();
    mockLayoutManager.getLayout.mockImplementation(async () => {
      return {
        id: "TEST_ID",
        name: "Test layout",
        baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
      };
    });
    mockLayoutManager.updateLayout.mockImplementation(async () => {
      layoutStoragePutCalled.resolve();
      return {
        id: "TEST_ID",
        name: "Test layout",
        baseline: { data: TEST_LAYOUT, updatedAt: new Date(10).toISOString() },
      };
    });
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const result = renderTest({
      mockLayoutManager,
      mockUserProfile,
    });
    await act(() => result.current.childMounted);
    const actions = result.current.actions;
    expect(result.current.actions).toBe(actions);
    act(() =>
      result.current.actions.savePanelConfigs({
        configs: [{ id: "ExamplePanel!1", config: { foo: "bar" } }],
      }),
    );
    await act(() => layoutStoragePutCalled);
    expect(result.current.actions.savePanelConfigs).toBe(actions.savePanelConfigs);
  });
});
