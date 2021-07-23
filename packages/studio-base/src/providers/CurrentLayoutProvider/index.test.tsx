/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act } from "@testing-library/react";
import { mount } from "enzyme";
import { ToastProvider } from "react-toast-notifications";

import {
  CurrentLayoutActions,
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import LayoutStorageContext from "@foxglove/studio-base/context/LayoutStorageContext";
import {
  UserProfileStorage,
  UserProfileStorageContext,
} from "@foxglove/studio-base/context/UserProfileStorageContext";
import welcomeLayout from "@foxglove/studio-base/layouts/welcomeLayout";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import { ILayoutStorage, LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import Storage from "@foxglove/studio-base/util/Storage";
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
    timeDisplayMethod: "ROS",
  },
};

function mockThrow(name: string) {
  return () => {
    throw new Error(`Unexpected mock function call ${name}`);
  };
}

function makeMockLayoutStorage() {
  return {
    supportsSharing: false,
    supportsSyncing: false,
    addLayoutsChangedListener: jest.fn(/*noop*/),
    removeLayoutsChangedListener: jest.fn(/*noop*/),
    getLayouts: jest.fn().mockImplementation(mockThrow("getLayouts")),
    getLayout: jest.fn().mockImplementation(mockThrow("getLayout")),
    saveNewLayout: jest.fn().mockImplementation(mockThrow("saveNewLayout")),
    updateLayout: jest.fn().mockImplementation(mockThrow("updateLayout")),
    syncLayout: jest.fn().mockImplementation(mockThrow("syncLayout")),
    deleteLayout: jest.fn().mockImplementation(mockThrow("deleteLayout")),
  };
}
function makeMockUserProfile() {
  return {
    getUserProfile: jest.fn().mockImplementation(mockThrow("getUserProfile")),
    setUserProfile: jest.fn().mockImplementation(mockThrow("setUserProfile")),
  };
}

function renderTest({
  mockLayoutStorage,
  mockUserProfile,
}: {
  mockLayoutStorage: ILayoutStorage;
  mockUserProfile: UserProfileStorage;
}) {
  const childMounted = signal();
  const currentLayoutStates: (LayoutState | undefined)[] = [];
  const actions: { current?: CurrentLayoutActions } = {};
  function Child() {
    childMounted.resolve();
    currentLayoutStates.push(useCurrentLayoutSelector((state) => state));
    actions.current = useCurrentLayoutActions();
    return ReactNull;
  }
  mount(
    <ToastProvider>
      <LayoutStorageContext.Provider value={mockLayoutStorage}>
        <UserProfileStorageContext.Provider value={mockUserProfile}>
          <CurrentLayoutProvider>
            <Child />
          </CurrentLayoutProvider>
        </UserProfileStorageContext.Provider>
      </LayoutStorageContext.Provider>
    </ToastProvider>,
  );
  return { currentLayoutStates, actions, childMounted };
}

describe("CurrentLayoutProvider", () => {
  it.each(["webvizGlobalState", "studioGlobalState"])(
    "migrates legacy layout from localStorage.%s into LayoutStorage/UserProfile",
    async (storageKey) => {
      const storage = new Storage();
      storage.clear();
      const persistedState: { panels: Partial<PanelsState> } = {
        panels: {
          layout: "Foo!bar",
          savedProps: { "Foo!bar": { setting: 1 } },
          globalVariables: { var: "hello" },
          linkedGlobalVariables: [{ topic: "/test", markerKeyPath: [], name: "var" }],
          userNodes: { node1: { name: "node", sourceCode: "node()" } },
          playbackConfig: { speed: 0.1, messageOrder: "headerStamp", timeDisplayMethod: "TOD" },
        },
      };
      storage.setItem(storageKey, persistedState);

      const layoutStoragePutCalled = signal();
      const layoutStorageUpdateCalled = signal();

      const mockLayoutStorage = makeMockLayoutStorage();
      mockLayoutStorage.saveNewLayout.mockImplementation(async ({ name }) => {
        layoutStoragePutCalled.resolve();
        return {
          id: "new-id",
          name,
        };
      });
      mockLayoutStorage.updateLayout.mockImplementation(async () =>
        layoutStorageUpdateCalled.resolve(),
      );

      const mockUserProfile = makeMockUserProfile();
      mockUserProfile.setUserProfile.mockResolvedValue(undefined);

      const { currentLayoutStates } = renderTest({ mockLayoutStorage, mockUserProfile });

      await act(() => layoutStoragePutCalled);
      await act(() => layoutStorageUpdateCalled);

      const expectedPanelsState = {
        ...persistedState.panels,
        // savedProps gets renamed to configById
        configById: persistedState.panels.savedProps,
        savedProps: undefined,
      };

      expect(mockLayoutStorage.saveNewLayout.mock.calls).toEqual([
        [
          {
            name: "unnamed",
            data: persistedState.panels,
            permission: "creator_write",
          },
        ],
      ]);
      expect(mockLayoutStorage.updateLayout.mock.calls).toEqual([
        [
          {
            targetID: "new-id",
            data: expectedPanelsState,
          },
        ],
      ]);

      expect(currentLayoutStates).toEqual([
        { selectedLayout: { id: "new-id", data: expectedPanelsState } },
      ]);
    },
  );

  it("loads first available layout when currentLayoutId is missing", async () => {
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.getLayouts.mockResolvedValue([{ id: "TEST_ID", name: "Test Layout" }]);
    mockLayoutStorage.getLayout.mockResolvedValueOnce({
      id: "TEST_ID",
      name: "Test Layout",
      data: TEST_LAYOUT,
    });

    const userProfileGetCalled = signal();
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockImplementation(() => {
      userProfileGetCalled.resolve();
      return {};
    });

    const { currentLayoutStates } = renderTest({ mockLayoutStorage, mockUserProfile });
    await act(() => userProfileGetCalled);

    expect(currentLayoutStates).toEqual([{ selectedLayout: { id: "TEST_ID", data: TEST_LAYOUT } }]);
  });

  it("saves welcome layout when no layouts are available missing", async () => {
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.getLayouts.mockResolvedValue([]);

    const layoutStoragePutCalled = signal();
    mockLayoutStorage.saveNewLayout.mockImplementation(async () => {
      layoutStoragePutCalled.resolve();
      return { id: "new-id" };
    });

    const userProfileGetCalled = signal();
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockImplementation(() => {
      userProfileGetCalled.resolve();
      return {};
    });

    const { currentLayoutStates } = renderTest({ mockLayoutStorage, mockUserProfile });
    await act(() => userProfileGetCalled);
    await act(() => layoutStoragePutCalled);

    expect(currentLayoutStates).toEqual([
      { selectedLayout: { id: "new-id", data: welcomeLayout.data } },
    ]);
  });

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
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.getLayout.mockImplementation(async () => {
      layoutStorageGetCalled.resolve();
      return { id: "example", name: "Example layout", data: expectedState };
    });

    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const { currentLayoutStates } = renderTest({ mockLayoutStorage, mockUserProfile });
    await act(() => layoutStorageGetCalled);

    expect(mockLayoutStorage.getLayout.mock.calls).toEqual([["example"]]);
    expect(currentLayoutStates).toEqual([
      { selectedLayout: { id: "example", data: expectedState } },
    ]);
  });

  it("saves new layout selection into UserProfile", async () => {
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.getLayout.mockImplementation(async () => {
      return { id: "example", name: "Example layout", data: TEST_LAYOUT };
    });

    const userProfileSetCalled = signal();
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });
    mockUserProfile.setUserProfile.mockImplementation(async () => {
      userProfileSetCalled.resolve();
    });

    const { currentLayoutStates, childMounted, actions } = renderTest({
      mockLayoutStorage,
      mockUserProfile,
    });
    const newLayout: Partial<PanelsState> = {
      ...TEST_LAYOUT,
      layout: "ExamplePanel!2",
    };
    await act(() => childMounted);
    act(() => actions.current?.setSelectedLayout({ id: "example2" as LayoutID, data: newLayout }));
    await act(() => userProfileSetCalled);

    expect(mockUserProfile.setUserProfile.mock.calls).toEqual([[{ currentLayoutId: "example2" }]]);
    expect(currentLayoutStates).toEqual([
      { selectedLayout: { id: "example", data: TEST_LAYOUT } },
      { selectedLayout: { id: "example2", data: newLayout } },
    ]);
  });

  it("saves layout updates into LayoutStorage", async () => {
    const layoutStoragePutCalled = signal();
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.getLayout.mockImplementation(async () => {
      return { id: "TEST_ID", name: "Test layout", data: TEST_LAYOUT };
    });
    mockLayoutStorage.updateLayout.mockImplementation(async () => layoutStoragePutCalled.resolve());

    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const { currentLayoutStates, childMounted, actions } = renderTest({
      mockLayoutStorage,
      mockUserProfile,
    });
    await act(() => childMounted);
    act(() => actions.current?.setPlaybackConfig({ timeDisplayMethod: "TOD" }));
    await act(() => layoutStoragePutCalled);

    const newState = {
      ...TEST_LAYOUT,
      playbackConfig: {
        ...TEST_LAYOUT.playbackConfig,
        timeDisplayMethod: "TOD",
      },
    };

    expect(mockLayoutStorage.updateLayout.mock.calls).toEqual([
      [{ targetID: "TEST_ID", data: newState }],
    ]);
    expect(currentLayoutStates).toEqual([
      { selectedLayout: { id: "TEST_ID", data: TEST_LAYOUT } },
      { selectedLayout: { id: "TEST_ID", data: newState } },
    ]);
  });

  it("unsets current layout when the current layout is deleted", async () => {
    const layoutStorageListCalled = signal();
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.getLayout.mockImplementation(async () => {
      return { id: "TEST_ID", name: "Test layout", data: TEST_LAYOUT };
    });
    mockLayoutStorage.getLayouts.mockImplementation(async () => {
      layoutStorageListCalled.resolve();
      return [];
    });

    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });
    mockUserProfile.setUserProfile.mockResolvedValue(undefined);

    const { currentLayoutStates, childMounted } = renderTest({
      mockLayoutStorage,
      mockUserProfile,
    });
    await act(() => childMounted);
    expect(currentLayoutStates).toEqual([{ selectedLayout: { id: "TEST_ID", data: TEST_LAYOUT } }]);

    expect(mockLayoutStorage.addLayoutsChangedListener).toHaveBeenCalledTimes(1);
    mockLayoutStorage.addLayoutsChangedListener.mock.calls[0][0]();

    await act(() => layoutStorageListCalled);

    expect(currentLayoutStates).toEqual([
      { selectedLayout: { id: "TEST_ID", data: TEST_LAYOUT } },
      { selectedLayout: undefined },
    ]);
    expect(mockUserProfile.setUserProfile.mock.calls).toEqual([[{ currentLayoutId: undefined }]]);
  });
});
