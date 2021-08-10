// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

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
  ConflictType,
  ConflictResolution,
} from "@foxglove/studio-base/services/ILayoutStorage";
import {
  RemoteLayoutMetadata,
  IRemoteLayoutStorage,
} from "@foxglove/studio-base/services/IRemoteLayoutStorage";
import WriteThroughLayoutCache from "@foxglove/studio-base/services/WriteThroughLayoutCache";
import filterMap from "@foxglove/studio-base/util/filterMap";

import computeLayoutSyncOperations, { SyncOperation } from "./computeLayoutSyncOperations";

const log = Logger.getLogger(__filename);

export type ConflictInfo = { cacheId: string; remoteId?: LayoutID; type: ConflictType };

/**
 * Determine the metadata that we should vend out to clients based on a cached layout. Uses the
 * layout's serverMetadata if available, except for local modifications.
 */
function getEffectiveMetadata(
  layout: CachedLayout,
  conflictsByCacheId: ReadonlyMap<string, ConflictInfo>,
): LayoutMetadata {
  return layout.serverMetadata != undefined
    ? {
        ...layout.serverMetadata,
        name: layout.name,
        hasUnsyncedChanges: layout.locallyModified ?? false,
        conflict: conflictsByCacheId.get(layout.id)?.type,
      }
    : {
        // When a layout is new on the client, we treat our local id as though it were a server id.
        // This will be replaced with the server id once we upload the layout.
        id: layout.id as LayoutID,

        name: layout.name,
        creatorUserId: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        permission: "creator_write",
        hasUnsyncedChanges: true,
        conflict: conflictsByCacheId.get(layout.id)?.type,
      };
}

/**
 * Provides a layout storage interface backed by a remote server, but with a local cache in between,
 * to provide offline access to layouts.
 *
 * The local cache is used first for all operations except layout sharing. A sync operation
 * determines what actions are needed to reconcile the cache with the remote storage, and performs
 * them or reports conflicts that it cannot resolve.
 *
 * By default we don't (currently) upload new layouts or changes made locally. The user triggers
 * these uploads with an explicit save action.
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

  private latestConflictsByCacheId: ReadonlyMap<string, ConflictInfo> = new Map();

  readonly supportsSharing = true;
  readonly supportsSyncing = true;

  private changeListeners = new Set<() => void>();

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

  addLayoutsChangedListener(listener: () => void): void {
    this.changeListeners.add(listener);
  }
  removeLayoutsChangedListener(listener: () => void): void {
    this.changeListeners.delete(listener);
  }
  private notifyChangeListeners() {
    queueMicrotask(() => {
      for (const listener of [...this.changeListeners]) {
        listener();
      }
    });
  }

  /** Helper function for read-modify-write operations in the cache storage. */
  private async updateCachedLayout(
    id: LayoutID,
    modify: (layout: CachedLayout | undefined) => CachedLayout,
  ) {
    await this.cacheStorage.runExclusive(async (cache) => {
      await cache.put(modify(await cache.get(id)));
    });
    this.notifyChangeListeners();
  }

  async getLayouts(): Promise<LayoutMetadata[]> {
    return filterMap(
      await this.cacheStorage.runExclusive(async (cache) => await cache.list()),
      (layout) =>
        layout.locallyDeleted === true && !this.latestConflictsByCacheId.has(layout.id)
          ? undefined
          : getEffectiveMetadata(layout, this.latestConflictsByCacheId),
    );
  }

  async getLayout(id: LayoutID): Promise<Layout | undefined> {
    const layout = await this.cacheStorage.runExclusive(async (cache) => await cache.get(id));
    if (layout?.locallyDeleted === true) {
      return undefined;
    }
    if (layout?.state) {
      return { ...getEffectiveMetadata(layout, this.latestConflictsByCacheId), data: layout.state };
    }
    // If the user has never selected this layout, or if it has been updated on the server since
    // last time it was selected, we need to query the server in order to hydrate the cached layout.
    const remoteLayout = await this.remoteStorage.getLayout(id);
    if (!remoteLayout) {
      // If we still have local metadata for this layout in the cache, it will be deleted during the
      // next sync.
      return undefined;
    }
    const { data, ...metadata } = remoteLayout;
    await this.cacheStorage.runExclusive(
      async (cache) =>
        // In the unlikely event that local modifications (rename or delete) got into the cache since we
        // last checked, the remote response will override them.
        await cache.put({
          id: metadata.id,
          name: metadata.name,
          state: data,
          serverMetadata: metadata,
        }),
    );
    this.notifyChangeListeners();
    return {
      ...remoteLayout,
      hasUnsyncedChanges: false,
      conflict: undefined,
    };
  }

  async saveNewLayout({
    name,
    data,
    permission,
  }: {
    name: string;
    data: PanelsState;
    permission: "creator_write" | "org_read" | "org_write";
  }): Promise<LayoutMetadata> {
    // For shared layouts, start by going directly to the server
    if (permission !== "creator_write") {
      const response = await this.remoteStorage.saveNewLayout({ name, data, permission });
      switch (response.status) {
        case "success":
          return await this.cacheStorage.runExclusive(async (cache) => {
            const layout = {
              id: response.newMetadata.id,
              name: response.newMetadata.name,
              state: data,
              serverMetadata: response.newMetadata,
            };
            await cache.put(layout);
            this.notifyChangeListeners();
            return getEffectiveMetadata(layout, this.latestConflictsByCacheId);
          });
        case "conflict":
          throw new Error("Unable to share layout");
      }
    }
    const newMetadata = await this.cacheStorage.runExclusive(async (cache) => {
      const layout = { id: uuidv4(), name, state: data };
      await cache.put(layout);
      return getEffectiveMetadata(layout, this.latestConflictsByCacheId);
    });
    this.notifyChangeListeners();
    return newMetadata;
  }

  async updateLayout({
    targetID,
    name,
    data,
  }: {
    targetID: LayoutID;
    name: string | undefined;
    data: PanelsState | undefined;
  }): Promise<void> {
    await this.updateCachedLayout(targetID, (layout) => {
      if (!layout) {
        throw new Error("Updating a layout not present in the cache");
      }
      return {
        ...layout,
        name: name ?? layout.name,
        state: data ?? layout.state,
        locallyModified: true,
      };
    });
    this.notifyChangeListeners();
  }

  async deleteLayout({ id }: { id: LayoutID }): Promise<void> {
    await this.updateCachedLayout(id, (layout) => {
      if (!layout) {
        throw new Error("Deleting a layout not present in the cache");
      }
      return { ...layout, locallyDeleted: true };
    });
    this.notifyChangeListeners();
  }

  /** Save a layout to the server following an explicit user action. */
  async syncLayout(
    id: LayoutID,
  ): Promise<{ status: "success"; newId?: LayoutID } | { status: "conflict"; type: ConflictType }> {
    const cachedLayout = await this.cacheStorage.runExclusive(async (cache) => await cache.get(id));
    try {
      if (cachedLayout?.serverMetadata != undefined) {
        const { conflict } = await this.performSyncOperation(
          { type: "upload-updated", cachedLayout, remoteLayout: cachedLayout.serverMetadata },
          { uploadSharedLayoutChanges: true },
        );
        return conflict ? { status: "conflict", type: conflict.type } : { status: "success" };
      } else if (cachedLayout?.state != undefined) {
        const { conflict, newId } = await this.performSyncOperation(
          { type: "upload-new", cachedLayout: { ...cachedLayout, state: cachedLayout.state } },
          { uploadSharedLayoutChanges: true },
        );
        return conflict
          ? { status: "conflict", type: conflict.type }
          : { status: "success", newId };
      }
      return { status: "success" };
    } finally {
      this.notifyChangeListeners();
    }
  }

  /** Ensures at most one sync operation is in progress at a time */
  private currentSync?: Promise<ReadonlyMap<string, ConflictInfo>>;

  /**
   * Attempt to synchronize the local cache with remote storage. At minimum this incurs a fetch of
   * the cached and remote layout lists; it may also involve modifications to the cache, remote
   * storage, or both.
   * @returns Any conflicts that arose during the sync.
   */
  async syncWithRemote(): Promise<ReadonlyMap<string, ConflictInfo>> {
    if (this.currentSync) {
      return await this.currentSync;
    }
    try {
      this.currentSync = this.syncWithRemoteImpl();
      this.latestConflictsByCacheId = await this.currentSync;
      this.notifyChangeListeners();
      return this.latestConflictsByCacheId;
    } finally {
      this.currentSync = undefined;
    }
  }

  private async syncWithRemoteImpl(): Promise<ReadonlyMap<string, ConflictInfo>> {
    const [cachedLayoutsById, remoteLayoutsById] = await Promise.all([
      this.cacheStorage
        .runExclusive(async (cache) => await cache.list())
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

    const operations = computeLayoutSyncOperations(cachedLayoutsById, remoteLayoutsById);
    log.info("Sync operations:", operations);

    // By default we don't upload edits to shared layouts. The user triggers these uploads with an
    // explicit save action.
    const conflicts = await this.performSyncOperations(operations, {
      uploadSharedLayoutChanges: false,
    });
    return new Map(conflicts.map((info) => [info.cacheId, info]));
  }

  private async performSyncOperations(
    operations: SyncOperation[],
    options: { uploadSharedLayoutChanges: boolean },
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    for (const operation of operations) {
      const { conflict } = await this.performSyncOperation(operation, options);
      if (conflict) {
        conflicts.push(conflict);
      }
    }
    return conflicts;
  }

  private async performSyncOperation(
    operation: SyncOperation,
    { uploadSharedLayoutChanges }: { uploadSharedLayoutChanges: boolean },
  ): Promise<{ conflict?: ConflictInfo; newId?: LayoutID }> {
    switch (operation.type) {
      case "conflict": {
        const { cachedLayout, conflictType } = operation;
        return {
          conflict: {
            cacheId: cachedLayout.id,
            remoteId: cachedLayout.serverMetadata?.id,
            type: conflictType,
          },
        };
      }

      case "add-to-cache": {
        const { remoteLayout } = operation;
        await this.cacheStorage.runExclusive(
          async (cache) =>
            await cache.put({
              id: remoteLayout.id,
              name: remoteLayout.name,
              state: undefined,
              serverMetadata: remoteLayout,
            }),
        );
        break;
      }

      case "update-cached-metadata": {
        const { cachedLayout, remoteLayout } = operation;
        await this.cacheStorage.runExclusive(
          async (cache) =>
            await cache.put({
              ...cachedLayout,
              name: remoteLayout.name,
              serverMetadata: remoteLayout,
              state: undefined, // clear out the state so we know it needs to be fetched from the server
              locallyDeleted: false,
              locallyModified: false,
            }),
        );
        break;
      }

      case "delete-local": {
        const { cachedLayout } = operation;
        await this.cacheStorage.runExclusive(async (cache) => await cache.delete(cachedLayout.id));
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
            await this.cacheStorage.runExclusive(
              async (cache) => await cache.delete(cachedLayout.id),
            );
            break;
          case "precondition-failed":
            return {
              conflict: {
                cacheId: cachedLayout.id,
                remoteId: remoteLayout.id,
                type: "local-delete-remote-update",
              },
            };
        }
        break;
      }

      case "upload-new": {
        const { cachedLayout } = operation;
        const response = await this.remoteStorage.saveNewLayout({
          name: cachedLayout.name,
          data: cachedLayout.state,
          permission: "creator_write",
        });
        switch (response.status) {
          case "success":
            // The server generated a new id, so ours gets replaced
            await this.cacheStorage.runExclusive(async (cache) => {
              await cache.put({
                id: response.newMetadata.id,
                name: response.newMetadata.name,
                state: cachedLayout.state,
                serverMetadata: response.newMetadata,
              });
              await cache.delete(cachedLayout.id);
            });
            return { newId: response.newMetadata.id };
          case "conflict":
            return {
              conflict: {
                cacheId: cachedLayout.id,
                remoteId: undefined,
                type: "name-collision",
              },
            };
        }
        break;
      }

      case "upload-updated": {
        const { cachedLayout, remoteLayout } = operation;
        if (!uploadSharedLayoutChanges && remoteLayout.permission !== "creator_write") {
          break;
        }
        const response = await this.remoteStorage.updateLayout({
          targetID: remoteLayout.id,
          name: cachedLayout.name,
          ifUnmodifiedSince: remoteLayout.updatedAt,
          data: cachedLayout.state,
        });
        switch (response.status) {
          case "success":
            await this.cacheStorage.runExclusive(
              async (cache) =>
                await cache.put({
                  ...cachedLayout,
                  locallyModified: false,
                  serverMetadata: response.newMetadata,
                }),
            );
            break;
          case "not-found":
            log.warn(
              `Tried to rename or upload a layout that didn't exist (${remoteLayout.id}). Ignoring until next sync.`,
            );
            break;
          case "precondition-failed":
            return {
              conflict: {
                cacheId: cachedLayout.id,
                remoteId: remoteLayout.id,
                type: "both-update",
              },
            };
          case "conflict":
            return {
              conflict: {
                cacheId: cachedLayout.id,
                remoteId: remoteLayout.id,
                type: "local-update-remote-delete",
              },
            };
        }
        return { newId: remoteLayout.id };
      }
    }
    return {};
  }

  async resolveConflict(
    id: LayoutID,
    resolution: ConflictResolution,
  ): Promise<{ status: "success"; newId?: LayoutID | undefined }> {
    switch (resolution) {
      case "delete-local":
        await this.cacheStorage.runExclusive(async (cache) => await cache.delete(id));
        await this.syncWithRemote();
        return { status: "success" };

      case "delete-remote": {
        const remoteLayout = await this.remoteStorage.getLayout(id);
        if (!remoteLayout) {
          return { status: "success" };
        }
        const response = await this.remoteStorage.deleteLayout({
          targetID: id,
          ifUnmodifiedSince: remoteLayout.updatedAt,
        });
        if (response.status !== "success") {
          throw new Error(`Unable to forcibly delete remote layout: ${response.status}`);
        }
        await this.syncWithRemote();
        return { status: "success" };
      }

      case "revert-local": {
        const remoteLayout = await this.remoteStorage.getLayout(id);
        if (!remoteLayout) {
          return { status: "success" };
        }
        await this.cacheStorage.runExclusive(async (cache) => {
          await cache.put({
            id: remoteLayout.id,
            name: remoteLayout.name,
            serverMetadata: remoteLayout,
            state: undefined, // clear out the state so we know it needs to be fetched from the server
          });
        });
        await this.syncWithRemote();
        return { status: "success" };
      }

      case "overwrite-remote": {
        const cachedLayout = await this.cacheStorage.runExclusive(
          async (cache) => await cache.get(id),
        );
        if (!cachedLayout || !cachedLayout.state) {
          return { status: "success" };
        }
        const remoteLayout = await this.remoteStorage.getLayout(id);

        // If the layout was deleted on the server, upload it as a new layout
        if (!remoteLayout) {
          if (!cachedLayout.serverMetadata) {
            throw new Error(`Expected serverMetadata when resolving conflict for ${id}`);
          }
          const response = await this.remoteStorage.saveNewLayout({
            name: cachedLayout.name,
            permission: cachedLayout.serverMetadata?.permission,
            data: cachedLayout.state,
          });
          if (response.status !== "success") {
            throw new Error(`Unable to re-upload remotely deleted layout: ${response.status}`);
          }
          await this.cacheStorage.runExclusive(async (cache) => {
            await cache.put({
              id: response.newMetadata.id,
              name: response.newMetadata.name,
              state: cachedLayout.state,
              serverMetadata: response.newMetadata,
            });
            await cache.delete(id);
          });
          return { status: "success", newId: response.newMetadata.id };
        }

        // Otherwise, update the remote layout with a new ifUnmodifiedSince
        const response = await this.remoteStorage.updateLayout({
          targetID: remoteLayout.id,
          name: cachedLayout.name,
          ifUnmodifiedSince: remoteLayout.updatedAt,
          data: cachedLayout.state,
        });
        if (response.status !== "success") {
          throw new Error(`Unable to forcibly overwrite remote layout: ${response.status}`);
        }
        await this.cacheStorage.runExclusive(async (cache) => {
          await cache.put({
            id,
            name: response.newMetadata.name,
            serverMetadata: response.newMetadata,
            state: cachedLayout.state,
          });
        });
        await this.syncWithRemote();
        return { status: "success" };
      }
    }
  }
}
