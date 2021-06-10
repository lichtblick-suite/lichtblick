/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act } from "@testing-library/react";
import { mount } from "enzyme";
import { ToastProvider } from "react-toast-notifications";
import { v4 as uuidv4 } from "uuid";

import {
  CurrentLayoutActions,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import LocalLayoutStorageContext from "@foxglove/studio-base/context/LocalLayoutStorageContext";
import { UserProfileStorageContext } from "@foxglove/studio-base/context/UserProfileStorageContext";
import welcomeLayout from "@foxglove/studio-base/layouts/welcomeLayout";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import { LocalLayout } from "@foxglove/studio-base/services/LocalLayoutStorage";
import Storage from "@foxglove/studio-base/util/Storage";
import signal from "@foxglove/studio-base/util/signal";

const TEST_LAYOUT: PanelsState = {
  id: uuidv4(),
  name: "Test layout",
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
    list: jest.fn().mockImplementation(mockThrow("list")),
    get: jest.fn().mockImplementation(mockThrow("get")),
    put: jest.fn().mockImplementation(mockThrow("put")),
    delete: jest.fn().mockImplementation(mockThrow("delete")),
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
  mockLayoutStorage: ReturnType<typeof makeMockLayoutStorage>;
  mockUserProfile: ReturnType<typeof makeMockUserProfile>;
}) {
  const childMounted = signal();
  const currentLayoutStates: PanelsState[] = [];
  const actions: { current?: CurrentLayoutActions } = {};
  function Child() {
    childMounted.resolve();
    currentLayoutStates.push(useCurrentLayoutSelector((state) => state));
    actions.current = useCurrentLayoutActions();
    return ReactNull;
  }
  mount(
    <ToastProvider>
      <LocalLayoutStorageContext.Provider value={mockLayoutStorage}>
        <UserProfileStorageContext.Provider value={mockUserProfile}>
          <CurrentLayoutProvider>
            <Child />
          </CurrentLayoutProvider>
        </UserProfileStorageContext.Provider>
      </LocalLayoutStorageContext.Provider>
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

      const mockLayoutStorage = makeMockLayoutStorage();
      mockLayoutStorage.put.mockImplementation(async () => layoutStoragePutCalled.resolve());

      const mockUserProfile = makeMockUserProfile();
      mockUserProfile.setUserProfile.mockResolvedValue(undefined);

      const { currentLayoutStates } = renderTest({ mockLayoutStorage, mockUserProfile });

      await act(() => layoutStoragePutCalled);

      const expectedPanelsState = {
        ...persistedState.panels,
        id: expect.any(String),
        name: "unnamed",
        // savedProps gets renamed to configById
        configById: persistedState.panels.savedProps,
        savedProps: undefined,
      } as PanelsState;

      expect(mockLayoutStorage.put.mock.calls).toEqual([
        [
          {
            id: expect.any(String),
            name: "unnamed",
            state: expectedPanelsState,
          } as LocalLayout,
        ],
      ]);

      expect(currentLayoutStates).toEqual([expectedPanelsState]);
    },
  );

  it("loads first available layout when currentLayoutId is missing", async () => {
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.list.mockResolvedValue([
      { id: TEST_LAYOUT.id, name: TEST_LAYOUT.name, state: TEST_LAYOUT },
    ]);

    const userProfileGetCalled = signal();
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockImplementation(() => {
      userProfileGetCalled.resolve();
      return {};
    });

    const { currentLayoutStates } = renderTest({ mockLayoutStorage, mockUserProfile });
    await act(() => userProfileGetCalled);

    expect(currentLayoutStates).toEqual([TEST_LAYOUT]);
  });

  it("loads welcome layout when no layouts are available missing", async () => {
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.list.mockResolvedValue([]);

    const userProfileGetCalled = signal();
    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockImplementation(() => {
      userProfileGetCalled.resolve();
      return {};
    });

    const { currentLayoutStates } = renderTest({ mockLayoutStorage, mockUserProfile });
    await act(() => userProfileGetCalled);

    expect(currentLayoutStates).toEqual([welcomeLayout]);
  });

  it("uses currentLayoutId from UserProfile to load from LayoutStorage", async () => {
    const expectedState: PanelsState = {
      layout: "Foo!bar",
      id: "example",
      name: "Example layout",
      configById: { "Foo!bar": { setting: 1 } },
      globalVariables: { var: "hello" },
      linkedGlobalVariables: [{ topic: "/test", markerKeyPath: [], name: "var" }],
      userNodes: { node1: { name: "node", sourceCode: "node()" } },
      playbackConfig: { speed: 0.1, messageOrder: "headerStamp", timeDisplayMethod: "TOD" },
    };
    const layoutStorageGetCalled = signal();
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.get.mockImplementation(async (): Promise<LocalLayout> => {
      layoutStorageGetCalled.resolve();
      return { id: "example", name: "Example layout", state: expectedState };
    });

    const mockUserProfile = makeMockUserProfile();
    mockUserProfile.getUserProfile.mockResolvedValue({ currentLayoutId: "example" });

    const { currentLayoutStates } = renderTest({ mockLayoutStorage, mockUserProfile });
    await act(() => layoutStorageGetCalled);

    expect(mockLayoutStorage.get.mock.calls).toEqual([["example"]]);
    expect(currentLayoutStates).toEqual([expectedState]);
  });

  it("saves new layout selection into UserProfile", async () => {
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.get.mockImplementation(async (): Promise<LocalLayout> => {
      return { id: "example", name: "Example layout", state: TEST_LAYOUT };
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
      id: "example2",
      name: "Example 2",
      layout: "ExamplePanel!2",
    };
    await act(() => childMounted);
    act(() => actions.current?.loadLayout(newLayout));
    await act(() => userProfileSetCalled);

    expect(mockUserProfile.setUserProfile.mock.calls).toEqual([[{ currentLayoutId: "example2" }]]);
    expect(currentLayoutStates).toEqual([TEST_LAYOUT, newLayout]);
  });

  it("saves layout updates into LayoutStorage", async () => {
    const layoutStoragePutCalled = signal();
    const mockLayoutStorage = makeMockLayoutStorage();
    mockLayoutStorage.get.mockImplementation(async (): Promise<LocalLayout> => {
      return { id: TEST_LAYOUT.id, name: TEST_LAYOUT.name, state: TEST_LAYOUT };
    });
    mockLayoutStorage.put.mockImplementation(async () => layoutStoragePutCalled.resolve());

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

    expect(mockLayoutStorage.put.mock.calls).toEqual([
      [{ id: TEST_LAYOUT.id, name: TEST_LAYOUT.name, state: newState }],
    ]);
    expect(currentLayoutStates).toEqual([TEST_LAYOUT, newState]);
  });
});
