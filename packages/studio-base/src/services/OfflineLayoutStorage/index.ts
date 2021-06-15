// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { MutexLocked } from "@foxglove/den/async";
import Logger from "@foxglove/log";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { CachedLayout, ILayoutCache } from "@foxglove/studio-base/services/ILayoutCache";
import {
  Layout,
  LayoutID,
  LayoutMetadata,
  ILayoutStorage,
} from "@foxglove/studio-base/services/ILayoutStorage";
import {
  RemoteLayoutMetadata,
  IRemoteLayoutStorage,
} from "@foxglove/studio-base/services/IRemoteLayoutStorage";
import WriteThroughLayoutCache from "@foxglove/studio-base/services/WriteThroughLayoutCache";
import filterMap from "@foxglove/studio-base/util/filterMap";

import computeLayoutSyncOperations, { ConflictType } from "./computeLayoutSyncOperations";
import getNewLayoutName from "./getNewLayoutName";

const log = Logger.getLogger(__filename);

export type ConflictInfo = { layoutName: string; type: ConflictType };

/**
 * Determine the metadata that we should vend out to clients based on a cached layout. Uses the
 * layout's serverMetadata if available.
 */
function getEffectiveMetadata(layout: CachedLayout): LayoutMetadata {
  return (
    layout.serverMetadata ?? {
      // When a layout is new on the client, we treat our local id as though it were a server id.
      // This will be replaced with the server id once we upload the layout.
      id: layout.id as LayoutID,

      name: layout.name,
      path: layout.path ?? [],
      creator: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      permission: "creator_write",
    }
  );
}

/**
 * Provides a layout storage interface backed by a remote server, but with a local cache in between,
 * to provide offline access to layouts.
 *
 * The local cache is used first for all operations except layout sharing. A sync operation
 * determines what actions are needed to reconcile the cache with the remote storage, and performs
 * them or reports conflicts that it cannot resolve.
 *
 * This object does not handle any timeout logic and assumes that timeouts from remote storage will
 * be bubbled up as errors.
 */
export default class OfflineLayoutStorage implements ILayoutStorage {
  /**
   * All access to cache storage is wrapped in a mutex to prevent multi-step operations (such as
   * reading and then writing a single layout, or writing one and deleting another) from getting
   * interleaved.
   */
  private cacheStorage: MutexLocked<ILayoutCache>;

  private remoteStorage: IRemoteLayoutStorage;

  readonly supportsSharing = true;

  constructor({
    cacheStorage,
    remoteStorage,
  }: {
    cacheStorage: ILayoutCache;
    remoteStorage: IRemoteLayoutStorage;
  }) {
    this.cacheStorage = new MutexLocked(new WriteThroughLayoutCache(cacheStorage));
    this.remoteStorage = remoteStorage;
  }

  /** Helper function for read-modify-write operations in the cache storage. */
  private async updateCachedLayout(
    id: LayoutID,
    modify: (layout: CachedLayout | undefined) => CachedLayout,
  ) {
    await this.cacheStorage.runExclusive(async (cache) => {
      await cache.put(modify(await cache.get(id)));
    });
  }

  async getLayouts(): Promise<LayoutMetadata[]> {
    return Array.from(
      await this.cacheStorage.runExclusive((cache) => cache.list()),
      getEffectiveMetadata,
    );
  }

  async getLayout(id: LayoutID): Promise<Layout | undefined> {
    const layout = await this.cacheStorage.runExclusive((cache) => cache.get(id));
    if (layout?.state) {
      return { ...getEffectiveMetadata(layout), data: layout.state };
    }
    // It's quite possible that we have metadata from the server from a previous sync, but no
    // locally cached data, if the user has never selected this layout before. We need to query the
    // server in order to hydrate our cached layout.
    const remoteLayout = await this.remoteStorage.getLayout(id);
    if (!remoteLayout) {
      // If we still have local metadata for this layout in the cache, it will be deleted during the
      // next sync.
      return undefined;
    }
    const { data, ...metadata } = remoteLayout;
    await this.cacheStorage.runExclusive((cache) =>
      // In the unlikely event that local modifications (rename or delete) got into the cache since we
      // last checked, the remote response will override them.
      cache.put({
        id: metadata.id,
        name: metadata.name,
        path: metadata.path,
        state: data,
        serverMetadata: metadata,
      }),
    );
    return remoteLayout;
  }

  async saveNewLayout({
    path,
    name,
    data,
  }: {
    path: string[];
    name: string;
    data: PanelsState;
  }): Promise<void> {
    await this.cacheStorage.runExclusive((cache) =>
      cache.put({ id: uuidv4(), name, path, state: data }),
    );
  }

  async updateLayout({
    path,
    name,
    data,
    targetID,
  }: {
    path: string[];
    name: string;
    data: PanelsState;
    targetID: LayoutID;
  }): Promise<void> {
    await this.updateCachedLayout(targetID, (layout) => {
      if (!layout) {
        throw new Error("Updating a layout not present in the cache");
      }
      return { ...layout, path, name, state: data, locallyModified: true };
    });
  }

  async deleteLayout({ id }: { id: LayoutID }): Promise<void> {
    await this.updateCachedLayout(id, (layout) => {
      if (!layout) {
        throw new Error("Deleting a layout not present in the cache");
      }
      return { ...layout, locallyDeleted: true };
    });
  }

  async renameLayout({
    id,
    name,
    path,
  }: {
    id: LayoutID;
    name: string;
    path: string[];
  }): Promise<void> {
    await this.updateCachedLayout(id, (layout) => {
      if (!layout) {
        throw new Error("Renaming a layout not present in the cache");
      }
      return { ...layout, name, path, locallyModified: true };
    });
  }

  /** Only works when online */
  async shareLayout(params: {
    sourceID: LayoutID;
    path: string[];
    name: string;
    permission: "org_read" | "org_write";
  }): Promise<void> {
    const response = await this.remoteStorage.shareLayout(params);
    switch (response.status) {
      case "success":
        break;
      case "not-found":
        throw new Error("The layout could not be found.");
      case "conflict":
        throw new Error("A layout with this name already exists.");
    }
  }

  /** Only works when online */
  async updateSharedLayout(params: {
    sourceID: LayoutID;
    path: string[];
    name: string;
    permission: "org_read" | "org_write";
    targetID: LayoutID;
  }): Promise<void> {
    const source = await this.cacheStorage.runExclusive((cache) => cache.get(params.sourceID));
    if (!source) {
      throw new Error(
        `Can't update shared layout ${params.sourceID} because it doesn't exist in the cache.`,
      );
    }
    if (!source.serverMetadata) {
      throw new Error(
        `Can't update shared layout ${params.sourceID} because it doesn't have metadata in the cache.`,
      );
    }

    const response = await this.remoteStorage.updateSharedLayout({
      ...params,
      ifUnmodifiedSince: source.serverMetadata.updatedAt,
    });
    switch (response.status) {
      case "success":
        break;
      case "not-found":
        throw new Error(`The shared layout could not be foud.`);
      case "precondition-failed":
        throw new Error(`This layout was already modified by someone else.`);
      case "conflict":
        throw new Error(`This layout was already deleted by someone else.`);
    }
  }

  private isSyncing = false;

  /**
   * Attempt to synchronize the local cache with remote storage. At minimum this incurs a fetch of
   * the cached and remote layout lists; it may also involve modifications to the cache, remote
   * storage, or both.
   * @returns Any conflicts that arose during the sync.
   */
  async syncWithRemote(): Promise<ConflictInfo[]> {
    if (this.isSyncing) {
      throw new Error("Only one syncWithRemote operation may be in progress at a time.");
    }
    try {
      this.isSyncing = true;
      return await this.syncWithRemoteImpl();
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncWithRemoteImpl(): Promise<ConflictInfo[]> {
    const [cachedLayoutsById, remoteLayoutsById] = await Promise.all([
      this.cacheStorage
        .runExclusive((cache) => cache.list())
        .then(
          (layouts): ReadonlyMap<string, CachedLayout> =>
            new Map(layouts.map((layout) => [layout.id, layout])),
        ),
      this.remoteStorage
        .getLayouts()
        .then(
          (layouts): ReadonlyMap<LayoutID, RemoteLayoutMetadata> =>
            new Map(layouts.map((layout) => [layout.id, layout])),
        ),
    ]);

    const conflicts: ConflictInfo[] = [];
    for (const operation of computeLayoutSyncOperations(cachedLayoutsById, remoteLayoutsById)) {
      switch (operation.type) {
        case "conflict": {
          const { cachedLayout, conflictType } = operation;
          conflicts.push({ layoutName: cachedLayout.name, type: conflictType });
          break;
        }

        case "add-to-cache": {
          const { remoteLayout } = operation;
          await this.cacheStorage.runExclusive((cache) =>
            cache.put({
              id: remoteLayout.id,
              name: remoteLayout.name,
              path: remoteLayout.path,
              state: undefined,
              serverMetadata: remoteLayout,
            }),
          );
          break;
        }

        case "update-cached-metadata": {
          const { cachedLayout, remoteLayout } = operation;
          await this.cacheStorage.runExclusive((cache) =>
            cache.put({
              ...cachedLayout,
              name: remoteLayout.name,
              path: remoteLayout.path,
              serverMetadata: remoteLayout,
              locallyDeleted: false,
              locallyModified: false,
            }),
          );
          break;
        }

        case "delete-local": {
          const { cachedLayout } = operation;
          await this.cacheStorage.runExclusive((cache) => cache.delete(cachedLayout.id));
          break;
        }

        case "delete-remote": {
          const { cachedLayout, remoteLayout } = operation;
          const response = await this.remoteStorage.deleteLayout({
            targetID: remoteLayout.id,
            ifUnmodifiedSince: remoteLayout.updatedAt,
          });
          switch (response.status) {
            case "success":
              await this.cacheStorage.runExclusive((cache) => cache.delete(cachedLayout.id));
              break;
            case "precondition-failed":
              conflicts.push({ layoutName: cachedLayout.name, type: "local-delete-remote-update" });
              break;
          }
          break;
        }

        case "upload-new": {
          const { cachedLayout } = operation;
          const newName = getNewLayoutName(
            cachedLayout.name,
            new Set(
              filterMap(remoteLayoutsById.values(), (layout) =>
                isEqual(cachedLayout.path ?? [], layout.path) ? layout.name : undefined,
              ),
            ),
          );
          const response = await this.remoteStorage.saveNewLayout({
            path: cachedLayout.path ?? [],
            name: newName,
            data: cachedLayout.state,
          });
          switch (response.status) {
            case "success":
              // The server generated a new id, so ours gets replaced
              await this.cacheStorage.runExclusive(async (cache) => {
                await cache.put({
                  id: response.newMetadata.id,
                  name: response.newMetadata.name,
                  path: response.newMetadata.path,
                  state: cachedLayout.state,
                  serverMetadata: response.newMetadata,
                });
                await cache.delete(cachedLayout.id);
              });
              break;
            case "conflict":
              conflicts.push({ layoutName: cachedLayout.name, type: "both-update" });
              break;
          }
          break;
        }

        case "upload-updated": {
          const { cachedLayout, remoteLayout } = operation;
          let responsePromise: ReturnType<IRemoteLayoutStorage["updateLayout"]>;
          if (!cachedLayout.state) {
            responsePromise = this.remoteStorage.renameLayout({
              targetID: remoteLayout.id,
              name: cachedLayout.name,
              path: cachedLayout.path ?? [],
              ifUnmodifiedSince: remoteLayout.updatedAt,
            });
          } else {
            responsePromise = this.remoteStorage.updateLayout({
              targetID: remoteLayout.id,
              name: cachedLayout.name,
              path: cachedLayout.path ?? [],
              ifUnmodifiedSince: remoteLayout.updatedAt,
              data: cachedLayout.state,
            });
          }
          const response = await responsePromise;
          switch (response.status) {
            case "success":
              await this.cacheStorage.runExclusive((cache) =>
                cache.put({ ...cachedLayout, serverMetadata: response.newMetadata }),
              );
              break;
            case "not-found":
              log.warn(
                `Tried to rename or upload a layout that didn't exist (${remoteLayout.id}). Ignoring until next sync.`,
              );
              break;
            case "precondition-failed":
              conflicts.push({ layoutName: cachedLayout.name, type: "both-update" });
              break;
            case "conflict":
              conflicts.push({
                layoutName: cachedLayout.name,
                type: "local-update-remote-delete",
              });
              break;
          }
          break;
        }
      }
    }
    return conflicts;
  }
}
