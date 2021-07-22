// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { CachedLayout } from "@foxglove/studio-base/services/ILayoutCache";
import {
  ISO8601Timestamp,
  Layout,
  LayoutID,
  LayoutMetadata,
} from "@foxglove/studio-base/services/ILayoutStorage";
import {
  RemoteLayout,
  RemoteLayoutMetadata,
} from "@foxglove/studio-base/services/IRemoteLayoutStorage";
import MockLayoutCache from "@foxglove/studio-base/services/MockLayoutCache";
import MockRemoteLayoutStorage, {
  FAKE_USER,
} from "@foxglove/studio-base/services/MockRemoteLayoutStorage";
import OfflineLayoutStorage from "@foxglove/studio-base/services/OfflineLayoutStorage";
import { PanelConfig } from "@foxglove/studio-base/types/panels";

function makePanelsState(configById: Record<string, PanelConfig>): PanelsState {
  return {
    configById,
    globalVariables: {},
    linkedGlobalVariables: [],
    playbackConfig: defaultPlaybackConfig,
    userNodes: {},
    layout: "dummy layout",
  };
}

describe("OfflineLayoutStorage", () => {
  jest.useFakeTimers();

  beforeEach(() => {
    jest.setSystemTime(0);
  });

  it("returns layout data from cache without fetching from remote storage", async () => {
    const remote1: RemoteLayout = {
      id: "id1" as LayoutID,
      path: ["a"],
      name: "Foo",
      creatorUserId: FAKE_USER.id,
      createdAt: new Date(1).toISOString() as ISO8601Timestamp,
      updatedAt: new Date(1).toISOString() as ISO8601Timestamp,
      permission: "creator_write",
      data: makePanelsState({}),
    };

    const cacheStorage = new MockLayoutCache([
      { id: "id1", name: "Foo", path: ["a"], state: remote1.data },
    ]);

    const remoteStorage = new MockRemoteLayoutStorage([remote1]);
    const remoteGetLayout = jest.spyOn(remoteStorage, "getLayout");

    const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });

    await expect(storage.getLayout(remote1.id)).resolves.toEqual({
      id: "id1",
      name: "Foo",
      path: ["a"],
      data: remote1.data,
      creatorUserId: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      permission: "creator_write",
      hasUnsyncedChanges: true,
    });

    expect(remoteGetLayout).toHaveBeenCalledTimes(0);
  });

  it("fetches layout data from the server on demand when only metadata is cached", async () => {
    const remote1: RemoteLayout = {
      id: "id1" as LayoutID,
      path: ["a"],
      name: "Foo",
      creatorUserId: FAKE_USER.id,
      createdAt: new Date(1).toISOString() as ISO8601Timestamp,
      updatedAt: new Date(1).toISOString() as ISO8601Timestamp,
      permission: "creator_write",
      data: makePanelsState({}),
    };

    const { data: _, ...serverMetadata } = remote1;
    const cacheStorage = new MockLayoutCache([
      { id: remote1.id, name: "Foo", path: ["a"], state: undefined, serverMetadata },
    ]);

    const remoteStorage = new MockRemoteLayoutStorage([remote1]);
    const remoteGetLayout = jest.spyOn(remoteStorage, "getLayout");

    const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });

    const expectedMetadata = { ...serverMetadata, hasUnsyncedChanges: false };
    await expect(storage.getLayouts()).resolves.toEqual([expectedMetadata]);

    expect(remoteGetLayout).toHaveBeenCalledTimes(0);

    const expectedLayout: Layout = { ...remote1, hasUnsyncedChanges: false, conflict: undefined };
    await expect(storage.getLayout(remote1.id)).resolves.toEqual(expectedLayout);
    expect(remoteGetLayout).toHaveBeenCalledTimes(1);
  });

  describe("syncWithRemote", () => {
    it("returns conflicts", async () => {
      const remote1: RemoteLayoutMetadata = {
        id: "id1" as LayoutID,
        path: ["a"],
        name: "Foo",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
      };
      const cacheStorage = new MockLayoutCache([
        {
          id: remote1.id,
          name: remote1.name,
          path: [],
          state: undefined,
          serverMetadata: remote1,
          locallyDeleted: true,
        },
      ]);
      const remoteStorage = new MockRemoteLayoutStorage([
        {
          ...remote1,
          data: makePanelsState({}),
          updatedAt: new Date(20).toISOString() as ISO8601Timestamp,
        },
      ]);
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });
      await expect(storage.syncWithRemote()).resolves.toEqual(
        new Map([
          [
            remote1.id,
            { cacheId: remote1.id, remoteId: remote1.id, type: "local-delete-remote-update" },
          ],
        ]),
      );
    });

    it("saves new metadata to cache", async () => {
      const remote1: RemoteLayoutMetadata = {
        id: "id1" as LayoutID,
        path: ["a"],
        name: "Foo",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
      };
      const cacheStorage = new MockLayoutCache();
      const remoteStorage = new MockRemoteLayoutStorage([
        { ...remote1, data: makePanelsState({}) },
      ]);
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });
      await expect(storage.syncWithRemote()).resolves.toEqual(new Map());

      await expect(cacheStorage.list()).resolves.toEqual([
        {
          id: remote1.id,
          path: remote1.path,
          name: remote1.name,
          serverMetadata: remote1,
        },
      ]);
    });

    it("saves newly updated metadata to cache", async () => {
      const remote1: RemoteLayoutMetadata = {
        id: "id1" as LayoutID,
        path: ["a"],
        name: "Foo",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
      };
      const remote1Updated: RemoteLayoutMetadata = {
        ...remote1,
        path: ["b", "c"],
        name: "Foo2",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(20).toISOString() as ISO8601Timestamp,
        permission: "org_read",
      };
      const cacheStorage = new MockLayoutCache([
        {
          id: remote1.id,
          path: remote1.path,
          name: remote1.name,
          state: undefined,
          serverMetadata: remote1,
        },
      ]);
      const remoteStorage = new MockRemoteLayoutStorage([
        { ...remote1Updated, data: makePanelsState({}) },
      ]);
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });
      await expect(storage.syncWithRemote()).resolves.toEqual(new Map());

      await expect(cacheStorage.list()).resolves.toEqual([
        {
          id: remote1.id,
          path: remote1Updated.path,
          name: remote1Updated.name,
          serverMetadata: remote1Updated,
          locallyModified: false,
          locallyDeleted: false,
        },
      ]);
    });

    it("deletes unmodified cached layouts", async () => {
      const remote1: RemoteLayoutMetadata = {
        id: "id1" as LayoutID,
        path: ["a"],
        name: "Foo",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
      };
      const cacheStorage = new MockLayoutCache([
        {
          id: remote1.id,
          path: remote1.path,
          name: remote1.name,
          state: undefined,
          serverMetadata: remote1,
        },
      ]);
      const remoteStorage = new MockRemoteLayoutStorage([]);
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });
      await expect(storage.syncWithRemote()).resolves.toEqual(new Map());
      await expect(cacheStorage.list()).resolves.toEqual([]);
    });

    it("filters locally deleted layouts out of results", async () => {
      const remote1: RemoteLayoutMetadata = {
        id: "id1" as LayoutID,
        path: ["a"],
        name: "Foo",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
      };
      const cacheStorage = new MockLayoutCache([
        {
          id: remote1.id,
          path: remote1.path,
          name: remote1.name,
          state: undefined,
          serverMetadata: remote1,
          locallyDeleted: true,
        },
      ]);
      const remoteStorage = new MockRemoteLayoutStorage([
        { ...remote1, data: makePanelsState({}) },
      ]);
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });
      await expect(storage.getLayouts()).resolves.toEqual([]);
      await expect(storage.getLayout(remote1.id)).resolves.toBeUndefined();
    });

    it("deletes locally deleted layouts from the server and then cache", async () => {
      const remote1: RemoteLayoutMetadata = {
        id: "id1" as LayoutID,
        path: ["a"],
        name: "Foo",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
      };
      const cacheStorage = new MockLayoutCache([
        {
          id: remote1.id,
          path: remote1.path,
          name: remote1.name,
          state: undefined,
          serverMetadata: remote1,
          locallyDeleted: true,
        },
      ]);
      const remoteStorage = new MockRemoteLayoutStorage([
        { ...remote1, data: makePanelsState({}) },
      ]);
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });
      await expect(storage.syncWithRemote()).resolves.toEqual(new Map());
      await expect(remoteStorage.getLayouts()).resolves.toEqual([]);
      await expect(cacheStorage.list()).resolves.toEqual([]);
    });

    it("writes new layouts to cache, then uploads them", async () => {
      const cacheStorage = new MockLayoutCache();
      const remoteStorage = new MockRemoteLayoutStorage();
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });

      await storage.saveNewLayout({
        path: ["a", "b"],
        name: "layout1",
        data: makePanelsState({}),
      });

      // The new layout is available from the cache immediately
      const expectedLayout: LayoutMetadata = {
        id: expect.any(String),
        path: ["a", "b"],
        name: "layout1",
        creatorUserId: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        permission: "creator_write",
        hasUnsyncedChanges: true,
        conflict: undefined,
      };
      const layouts = await storage.getLayouts();
      expect(layouts).toEqual([expectedLayout]);

      const expectedCached: CachedLayout = {
        id: expect.any(String),
        path: ["a", "b"],
        name: "layout1",
        state: makePanelsState({}),
      };

      // The new layout has been written to cache storage and not remote storage
      const cachedLayouts = await cacheStorage.list();
      expect(cachedLayouts).toEqual([expectedCached]);
      expectedCached.id = cachedLayouts[0]!.id;

      await expect(remoteStorage.getLayouts()).resolves.toEqual([]);

      // Regular sync action does not upload
      jest.setSystemTime(5);
      await expect(storage.syncWithRemote()).resolves.toEqual(new Map());
      await expect(remoteStorage.getLayouts()).resolves.toEqual([]);

      // After explicit syncing, the layout is written to the remote storage
      jest.setSystemTime(10);
      await storage.syncLayout(layouts[0]!.id);
      const expectedRemote: RemoteLayoutMetadata = {
        id: expect.any(String),
        path: ["a", "b"],
        name: "layout1",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
      };
      const remoteLayouts = await remoteStorage.getLayouts();
      expect(remoteLayouts).toEqual([expectedRemote]);
      expectedRemote.id = remoteLayouts[0]!.id;

      // A new id has been assigned by the server
      expect(expectedRemote.id).not.toEqual(expectedCached.id);
      expectedCached.id = remoteLayouts[0]!.id;

      await expect(remoteStorage.getLayout(expectedRemote.id)).resolves.toEqual({
        ...expectedRemote,
        data: expectedCached.state,
      });

      // The new server metadata has been written to the cache, replacing the old metadata
      await expect(cacheStorage.list()).resolves.toEqual([
        { ...expectedCached, serverMetadata: expectedRemote },
      ]);
      expectedLayout.hasUnsyncedChanges = false;
      await expect(storage.getLayouts()).resolves.toEqual([
        {
          id: expectedCached.id,
          path: ["a", "b"],
          name: "layout1",
          creatorUserId: FAKE_USER.id,
          createdAt: new Date(10).toISOString() as ISO8601Timestamp,
          updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
          permission: "creator_write",
          hasUnsyncedChanges: false,
        },
      ]);
    });

    it("doesn't upload new layouts if there is a name conflict", async () => {
      const existingLayout: RemoteLayout = {
        id: "id1" as LayoutID,
        path: ["a"],
        name: "Foo",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
        data: makePanelsState({ existingPanel: { a: 1 } }),
      };
      const cacheStorage = new MockLayoutCache();
      const remoteStorage = new MockRemoteLayoutStorage([existingLayout]);
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });

      const { id: newId1 } = await storage.saveNewLayout({
        path: ["a"],
        name: "Foo",
        data: makePanelsState({ newLayoutPanel: { b: 2 } }),
      });
      const { id: newId2 } = await storage.saveNewLayout({
        path: ["b", "c"],
        name: "Foo",
        data: makePanelsState({ newLayoutPanel2: { c: 3 } }),
      });

      jest.setSystemTime(10);
      await expect(storage.syncLayout(newId1)).resolves.toEqual({
        status: "conflict",
        type: "name-collision",
      });
      await expect(storage.syncLayout(newId2)).resolves.toEqual({
        status: "success",
        newId: expect.any(String),
      });

      const remoteLayouts = await remoteStorage.getLayouts();
      expect(remoteLayouts).toEqual([
        { ...existingLayout, data: undefined },
        {
          id: expect.any(String),
          path: ["b", "c"],
          name: "Foo", // no conflict - not renamed
          creatorUserId: FAKE_USER.id,
          createdAt: new Date(10).toISOString() as ISO8601Timestamp,
          updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
          permission: "creator_write",
        },
      ]);
    });

    it("uploads locally modified layouts to the server", async () => {
      const remote1: RemoteLayoutMetadata = {
        id: "id1" as LayoutID,
        path: ["a"],
        name: "Foo",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
      };
      const cacheStorage = new MockLayoutCache([
        {
          id: remote1.id,
          path: ["b", "c"],
          name: "Bar",
          state: makePanelsState({ fooPanel: { a: 1 } }),
          serverMetadata: remote1,
          locallyModified: true,
        },
      ]);
      const remoteStorage = new MockRemoteLayoutStorage([
        { ...remote1, data: makePanelsState({}) },
      ]);
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });

      jest.setSystemTime(20);
      await expect(storage.syncLayout(remote1.id)).resolves.toEqual({ status: "success" });
      await expect(remoteStorage.getLayouts()).resolves.toEqual([
        {
          ...remote1,
          path: ["b", "c"],
          name: "Bar",
          updatedAt: new Date(20).toISOString() as ISO8601Timestamp,
        },
      ]);
      await expect(remoteStorage.getLayout(remote1.id)).resolves.toEqual({
        ...remote1,
        path: ["b", "c"],
        name: "Bar",
        updatedAt: new Date(20).toISOString() as ISO8601Timestamp,
        data: makePanelsState({ fooPanel: { a: 1 } }),
      });
    });

    it("renames locally renamed layouts on the server when only metadata is cached", async () => {
      const remote1: RemoteLayoutMetadata = {
        id: "id1" as LayoutID,
        path: ["a"],
        name: "Foo",
        creatorUserId: FAKE_USER.id,
        createdAt: new Date(10).toISOString() as ISO8601Timestamp,
        updatedAt: new Date(10).toISOString() as ISO8601Timestamp,
        permission: "creator_write",
      };
      const cacheStorage = new MockLayoutCache([
        {
          id: remote1.id,
          path: ["b", "c"],
          name: "Bar",
          state: undefined,
          serverMetadata: remote1,
          locallyModified: true,
        },
      ]);
      const remoteStorage = new MockRemoteLayoutStorage([
        { ...remote1, data: makePanelsState({ fooPanel: { a: 1 } }) },
      ]);
      const storage = new OfflineLayoutStorage({ cacheStorage, remoteStorage });

      jest.setSystemTime(20);
      await expect(storage.syncWithRemote()).resolves.toEqual(new Map());
      await expect(storage.syncLayout(remote1.id)).resolves.toEqual({ status: "success" });
      await expect(remoteStorage.getLayouts()).resolves.toEqual([
        {
          ...remote1,
          path: ["b", "c"],
          name: "Bar",
          updatedAt: new Date(20).toISOString() as ISO8601Timestamp,
        },
      ]);
      await expect(remoteStorage.getLayout(remote1.id)).resolves.toEqual({
        ...remote1,
        path: ["b", "c"],
        name: "Bar",
        updatedAt: new Date(20).toISOString() as ISO8601Timestamp,
        data: makePanelsState({ fooPanel: { a: 1 } }),
      });
    });
  });
});
