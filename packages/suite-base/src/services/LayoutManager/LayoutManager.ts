// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import * as _ from "lodash-es";
import { v4 as uuidv4 } from "uuid";

import { MutexLocked } from "@lichtblick/den/async";
import Logger from "@lichtblick/log";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { UserProfileStorage } from "@lichtblick/suite-base/context/UserProfileStorageContext";
import {
  ILayoutManager,
  LayoutFavorites,
  LayoutManagerChangeEvent,
  LayoutManagerEventTypes,
  SetOnlineProps,
} from "@lichtblick/suite-base/services/ILayoutManager";
import {
  ILayoutStorage,
  ISO8601Timestamp,
  Layout,
  LayoutPermission,
  layoutAppearsDeleted,
  layoutIsShared,
  layoutPermissionIsShared,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import { IRemoteLayoutFavoritesStorage } from "@lichtblick/suite-base/services/IRemoteLayoutFavoritesStorage";
import { IRemoteLayoutStorage } from "@lichtblick/suite-base/services/IRemoteLayoutStorage";
import computeLayoutSyncOperations, {
  SyncOperation,
} from "@lichtblick/suite-base/services/LayoutManager/utils/computeLayoutSyncOperations";
import { isLayoutEqual } from "@lichtblick/suite-base/services/LayoutManager/utils/isLayoutEqual";
import { updateOrFetchLayout } from "@lichtblick/suite-base/services/LayoutManager/utils/updateOrFetchLayouts";

import { migratePanelsState } from "../migrateLayout";
import { NamespacedLayoutStorage } from "./NamespacedLayoutStorage";
import WriteThroughLayoutCache from "./WriteThroughLayoutCache";
import { emitBusyStatus } from "./utils/emitBusyStatus.decorator";

const log = Logger.getLogger(__filename);

export type SaveNewLayout = {
  name: string;
  data: LayoutData;
  permission: LayoutPermission;
  from?: string;
};

function updateIds(
  ids: ReadonlySet<string>,
  id: string,
  { included }: { included: boolean },
): ReadonlySet<string> {
  if (ids.has(id) === included) {
    return ids;
  }
  const next = new Set(ids);
  if (included) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

type FavoriteKind = keyof LayoutFavorites;

export default class LayoutManager implements ILayoutManager {
  public static readonly LOCAL_STORAGE_NAMESPACE = "local";
  public static readonly REMOTE_STORAGE_NAMESPACE_PREFIX = "remote-";
  public readonly supportsSharing: boolean;
  public isOnline = false;
  public error: Error | undefined = undefined;
  public favorites: LayoutFavorites = { personal: new Set(), shared: new Set() };

  private emitter = new EventEmitter<LayoutManagerEventTypes>();
  private busyCount = 0;
  /**
   * All access to storage is wrapped in a mutex to prevent multi-step operations (such as reading
   * and then writing a single layout, or writing one and deleting another) from getting
   * interleaved.
   */
  private local: MutexLocked<NamespacedLayoutStorage>;
  private remote: IRemoteLayoutStorage | undefined;
  /** Ensures at most one sync operation is in progress at a time */
  private currentSync?: Promise<void>;

  /** Stores the favorites of personal layouts, which only exist locally. */
  private userProfile: UserProfileStorage | undefined;
  /** Stores the favorites of shared layouts. */
  private remoteFavorites: IRemoteLayoutFavoritesStorage | undefined;
  private personalFavoritesLoad?: Promise<void>;
  private sharedFavoritesLoad: Promise<void> = Promise.resolve();
  /** Generations of the last started and last applied loads of shared favorites. */
  private sharedFavoritesRequestedGeneration = 0;
  private sharedFavoritesAppliedGeneration = 0;
  /** Favorites as last loaded from or written to their storage. Failed writes roll back to it. */
  private savedFavorites: LayoutFavorites = { personal: new Set(), shared: new Set() };
  /** The last write per layout. Each write waits for the previous one of its layout. */
  private favoriteWrites: Record<FavoriteKind, Map<string, Promise<void>>> = {
    personal: new Map(),
    shared: new Map(),
  };
  /**
   * The writes saved while each load of shared favorites is running, by external id. The load's
   * response may predate them, so they take precedence over it.
   */
  private sharedFavoriteLoads = new Set<Map<string, boolean>>();

  public constructor({
    local,
    remote,
    userProfile,
    remoteFavorites,
  }: {
    local: ILayoutStorage;
    remote: IRemoteLayoutStorage | undefined;
    /** Without it, personal layouts cannot be marked as favorite. */
    userProfile?: UserProfileStorage;
    /** Without it, shared layouts cannot be marked as favorite. */
    remoteFavorites?: IRemoteLayoutFavoritesStorage;
  }) {
    this.local = new MutexLocked(
      new NamespacedLayoutStorage(
        new WriteThroughLayoutCache(local),
        remote
          ? LayoutManager.REMOTE_STORAGE_NAMESPACE_PREFIX + remote.workspace
          : LayoutManager.LOCAL_STORAGE_NAMESPACE,
        {
          migrateUnnamespacedLayouts: true,

          // Convert existing local layouts into cloud personal layouts
          importFromNamespace: remote ? LayoutManager.LOCAL_STORAGE_NAMESPACE : undefined,
        },
      ),
    );
    this.remote = remote;
    this.supportsSharing = remote != undefined;
    this.userProfile = userProfile;
    this.remoteFavorites = remoteFavorites;
  }

  public isBusy(): boolean {
    return this.busyCount > 0;
  }

  public setOnline({ online }: SetOnlineProps): void {
    this.isOnline = online;
    this.emitter.emit("onlinechange");
    if (online && this.remoteFavorites) {
      this.sharedFavoritesLoad = this.loadSharedFavorites(this.remoteFavorites);
    }
  }

  public setError(error: undefined | Error): void {
    this.error = error;
    this.emitter.emit("errorchange");
  }

  public on<E extends EventEmitter.EventNames<LayoutManagerEventTypes>>(
    name: E,
    listener: EventEmitter.EventListener<LayoutManagerEventTypes, E>,
  ): void {
    this.emitter.on(name, listener);
  }

  public off<E extends EventEmitter.EventNames<LayoutManagerEventTypes>>(
    name: E,
    listener: EventEmitter.EventListener<LayoutManagerEventTypes, E>,
  ): void {
    this.emitter.off(name, listener);
  }

  private notifyChangeListeners(event: LayoutManagerChangeEvent) {
    queueMicrotask(() => this.emitter.emit("change", event));
  }

  public async getLayouts(): Promise<readonly Layout[]> {
    return await this.local.runExclusive(async (local) => {
      const layouts = await local.list();
      return layouts.filter((layout) => !layoutAppearsDeleted(layout));
    });
  }

  public async getLayout(id: LayoutID): Promise<Layout | undefined> {
    const existingLocal = await this.local.runExclusive(async (local) => {
      return await local.get(id);
    });
    if (existingLocal) {
      return layoutAppearsDeleted(existingLocal) ? undefined : existingLocal;
    }

    log.debug(`No local layout id:${id}.`);

    // If we are offline, there's nothing else we can do to load the layout
    if (!this.isOnline) {
      log.debug("LayoutManager offline");
      return undefined;
    }

    log.debug(`Attempting to fetch from remote id:${id}`);
    // We couldn't find an existing local layout for our id, so we attempt to load the remote one
    const remoteLayout = await this.remote?.getLayout(id);
    if (!remoteLayout) {
      log.debug(`No remote layout with id:${id}`);
      return undefined;
    }
    return await this.local.runExclusive(async (local) => {
      // Layout sync may have happened while we fetched the remote layout.
      // We see if we have the layout locally and use that before caching the fetched remote layout.
      const localLayout = await local.get(id);
      if (localLayout) {
        log.debug(`Local layout loaded while fetching remote id:${id}`);
        return localLayout;
      }
      log.debug(`Adding layout to cache from getLayout: ${remoteLayout.id}`);
      return await local.put({
        id: remoteLayout.id,
        name: remoteLayout.name,
        permission: remoteLayout.permission,
        baseline: { data: remoteLayout.data, savedAt: remoteLayout.savedAt },
        working: undefined,
        syncInfo: layoutPermissionIsShared(remoteLayout.permission)
          ? { status: "tracked", lastRemoteSavedAt: remoteLayout.savedAt }
          : undefined,
      });
    });
  }

  @emitBusyStatus
  public async saveNewLayout({
    name,
    data: unmigratedData,
    permission,
    from,
  }: SaveNewLayout): Promise<Layout> {
    const data = migratePanelsState(unmigratedData);
    if (layoutPermissionIsShared(permission)) {
      if (!this.remote) {
        throw new Error("Shared layouts are not supported without remote layout storage");
      }
      if (!this.isOnline) {
        throw new Error("Cannot share a layout while offline");
      }
      const newLayout = await this.remote.saveNewLayout({
        id: uuidv4() as LayoutID,
        name,
        data,
        permission,
      });
      const localLayoutData = {
        id: newLayout.id,
        name: newLayout.name,
        externalId: newLayout.externalId,
        permission: newLayout.permission,
        baseline: { data: newLayout.data, savedAt: newLayout.savedAt },
        working: undefined,
        syncInfo: { status: "tracked" as const, lastRemoteSavedAt: newLayout.savedAt },
      };

      const result = await this.local.runExclusive(
        async (local) => await local.put(localLayoutData),
      );
      this.notifyChangeListeners({ type: "change", updatedLayout: result });
      return result;
    }

    const newLayout = await this.local.runExclusive(
      async (local) =>
        await local.put({
          id: uuidv4() as LayoutID,
          name,
          from,
          permission,
          baseline: { data, savedAt: new Date().toISOString() as ISO8601Timestamp },
          working: undefined,
          syncInfo: undefined, // Personal layouts should NEVER have syncInfo
        }),
    );
    this.notifyChangeListeners({ type: "change", updatedLayout: newLayout });
    return newLayout;
  }

  @emitBusyStatus
  public async updateLayout({
    id,
    name,
    data,
  }: {
    id: LayoutID;
    name: string | undefined;
    data: LayoutData | undefined;
  }): Promise<Layout> {
    const now = new Date().toISOString() as ISO8601Timestamp;
    const localLayout = await this.local.runExclusive(async (local) => await local.get(id));
    if (!localLayout) {
      throw new Error(`Cannot update layout ${id} (${name}) because it does not exist`);
    }

    // If the modifications result in the same layout data, set the working copy to undefined so the
    // layout appears unmodified.
    const newWorking =
      data == undefined
        ? localLayout.working
        : isLayoutEqual(localLayout.baseline.data, data)
          ? undefined
          : { data, savedAt: now };

    // Renames of shared layouts go directly to the server
    if (name != undefined && layoutIsShared(localLayout)) {
      if (!this.remote) {
        throw new Error("Shared layouts are not supported without remote layout storage");
      }
      if (!this.isOnline) {
        throw new Error("Cannot update a shared layout while offline");
      }
      if (!localLayout.externalId) {
        throw new Error("Local layout does not have externalId");
      }

      const updatedBaseline = await updateOrFetchLayout(this.remote, {
        id,
        externalId: localLayout.externalId,
        name,
        savedAt: now,
      });
      const result = await this.local.runExclusive(
        async (local) =>
          await local.put({
            ...localLayout,
            name: updatedBaseline.name,
            baseline: { data: updatedBaseline.data, savedAt: updatedBaseline.savedAt },
            working: newWorking,
            syncInfo: { status: "tracked", lastRemoteSavedAt: updatedBaseline.savedAt },
          }),
      );
      this.notifyChangeListeners({ type: "change", updatedLayout: result });
      return result;
    } else {
      // Only shared layouts should be marked for server upload on rename
      const isRename =
        this.remote != undefined &&
        name != undefined &&
        layoutIsShared(localLayout) &&
        localLayout.syncInfo != undefined &&
        localLayout.syncInfo.status !== "new";

      const result = await this.local.runExclusive(
        async (local) =>
          await local.put({
            ...localLayout,
            name: name ?? localLayout.name,
            working: newWorking,

            // If the name is being changed, we will need to upload to the server with a new savedAt
            baseline: isRename ? { ...localLayout.baseline, savedAt: now } : localLayout.baseline,
            syncInfo: layoutIsShared(localLayout)
              ? isRename
                ? { status: "updated", lastRemoteSavedAt: localLayout.syncInfo?.lastRemoteSavedAt }
                : localLayout.syncInfo
              : undefined, // Personal layouts should NEVER have syncInfo
          }),
      );
      this.notifyChangeListeners({ type: "change", updatedLayout: result });
      return result;
    }
  }

  @emitBusyStatus
  public async deleteLayout({ id }: { id: LayoutID }): Promise<void> {
    const localLayout = await this.local.runExclusive(async (local) => await local.get(id));
    if (!localLayout) {
      throw new Error(`Cannot delete layout ${id} because it does not exist`);
    }

    if (layoutIsShared(localLayout)) {
      if (!this.remote) {
        throw new Error("Shared layouts are not supported without remote layout storage");
      }
      if (!localLayout.externalId) {
        throw new Error("Local layout does not have externalId");
      }
      if (localLayout.syncInfo?.status !== "remotely-deleted") {
        if (!this.isOnline) {
          throw new Error("Cannot delete a shared layout while offline");
        }
        await this.remote.deleteLayout(localLayout.externalId);
      }
    }
    await this.local.runExclusive(async (local) => {
      if (this.remote && !layoutIsShared(localLayout)) {
        await local.put({
          ...localLayout,
          working: {
            data: localLayout.working?.data ?? localLayout.baseline.data,
            savedAt: new Date().toISOString() as ISO8601Timestamp,
          },
          syncInfo: {
            status: "locally-deleted",
            lastRemoteSavedAt: localLayout.syncInfo?.lastRemoteSavedAt,
          },
        });
      } else {
        await local.delete(id);
      }
    });
    this.notifyChangeListeners({ type: "delete", layoutId: id });
  }

  @emitBusyStatus
  public async overwriteLayout({ id }: { id: LayoutID }): Promise<Layout> {
    const localLayout = await this.local.runExclusive(async (local) => await local.get(id));
    if (!localLayout) {
      throw new Error(`Cannot overwrite layout ${id} because it does not exist`);
    }
    const now = new Date().toISOString() as ISO8601Timestamp;
    if (layoutIsShared(localLayout)) {
      if (!this.remote) {
        throw new Error("Shared layouts are not supported without remote layout storage");
      }
      if (!this.isOnline) {
        throw new Error("Cannot save a shared layout while offline");
      }
      if (!localLayout.externalId) {
        throw new Error("Local layout does not have externalId");
      }
      const updatedBaseline = await updateOrFetchLayout(this.remote, {
        id,
        externalId: localLayout.externalId,
        data: localLayout.working?.data ?? localLayout.baseline.data,
        savedAt: now,
      });
      const result = await this.local.runExclusive(
        async (local) =>
          await local.put({
            ...localLayout,
            baseline: { data: updatedBaseline.data, savedAt: updatedBaseline.savedAt },
            working: undefined,
            syncInfo: { status: "tracked", lastRemoteSavedAt: updatedBaseline.savedAt },
          }),
      );
      this.notifyChangeListeners({ type: "change", updatedLayout: result });
      return result;
    } else {
      const result = await this.local.runExclusive(
        async (local) =>
          await local.put({
            ...localLayout,
            baseline: {
              data: localLayout.working?.data ?? localLayout.baseline.data,
              savedAt: now,
            },
            working: undefined,
            syncInfo: undefined, // Personal layouts should NEVER have syncInfo
          }),
      );
      this.notifyChangeListeners({ type: "change", updatedLayout: result });
      return result;
    }
  }

  @emitBusyStatus
  public async revertLayout({ id }: { id: LayoutID }): Promise<Layout> {
    const result = await this.local.runExclusive(async (local) => {
      const layout = await local.get(id);
      if (!layout) {
        throw new Error(`Cannot revert layout id ${id} because it does not exist`);
      }
      return await local.put({
        ...layout,
        working: undefined,
      });
    });
    this.notifyChangeListeners({ type: "revert", updatedLayout: result });
    return result;
  }

  @emitBusyStatus
  public async makePersonalCopy({ id, name }: { id: LayoutID; name: string }): Promise<Layout> {
    const now = new Date().toISOString() as ISO8601Timestamp;
    const result = await this.local.runExclusive(async (local) => {
      const layout = await local.get(id);
      if (!layout) {
        throw new Error(`Cannot make a personal copy of layout id ${id} because it does not exist`);
      }
      const newLayout = await local.put({
        id: uuidv4() as LayoutID,
        name,
        permission: "CREATOR_WRITE",
        baseline: { data: layout.working?.data ?? layout.baseline.data, savedAt: now },
        working: undefined,
        syncInfo: { status: "new", lastRemoteSavedAt: now },
      });
      await local.put({ ...layout, working: undefined });
      return newLayout;
    });
    this.notifyChangeListeners({ type: "change", updatedLayout: undefined });
    return result;
  }

  public async getFavorites(): Promise<LayoutFavorites> {
    await Promise.all([this.loadPersonalFavorites(), this.sharedFavoritesLoad]);
    return this.favorites;
  }

  public canFavorite(layout: Layout): boolean {
    return layoutIsShared(layout)
      ? this.remoteFavorites != undefined && layout.externalId != undefined
      : this.userProfile != undefined;
  }

  public async setFavorite(layout: Layout, params: { favorite: boolean }): Promise<void> {
    const { userProfile, remoteFavorites } = this;
    if (!layoutIsShared(layout) && userProfile) {
      await this.setPersonalFavorite(userProfile, layout.id, params);
    } else if (layoutIsShared(layout) && remoteFavorites && layout.externalId != undefined) {
      await this.setSharedFavorite(remoteFavorites, layout.externalId, params);
    } else {
      throw new Error(`Layout "${layout.name}" cannot be marked as favorite`);
    }
  }

  private updateFavorites(update: Partial<LayoutFavorites>): void {
    const next = { ...this.favorites, ...update };
    if (next.personal === this.favorites.personal && next.shared === this.favorites.shared) {
      return;
    }
    this.favorites = next;
    this.emitter.emit("favoriteschange");
  }

  private async loadPersonalFavorites(): Promise<void> {
    const userProfile = this.userProfile;
    if (!userProfile) {
      return;
    }
    this.personalFavoritesLoad ??= userProfile
      .getUserProfile()
      .then(({ favoriteLayoutIds = [] }) => {
        const personal = new Set(favoriteLayoutIds);
        this.savedFavorites = { ...this.savedFavorites, personal };
        this.updateFavorites({ personal });
      })
      .catch((error: unknown) => {
        log.error("Failed to load personal favorite layouts", error);
      });
    await this.personalFavoritesLoad;
  }

  private async loadSharedFavorites(remote: IRemoteLayoutFavoritesStorage): Promise<void> {
    const generation = ++this.sharedFavoritesRequestedGeneration;
    const savedWhileLoading = new Map<string, boolean>();
    this.sharedFavoriteLoads.add(savedWhileLoading);
    try {
      const ids = await remote.getFavoriteLayoutIds();
      if (generation < this.sharedFavoritesAppliedGeneration) {
        return;
      }
      this.sharedFavoritesAppliedGeneration = generation;
      let saved: ReadonlySet<string> = new Set(ids);
      for (const [externalId, favorite] of savedWhileLoading) {
        saved = updateIds(saved, externalId, { included: favorite });
      }
      this.savedFavorites = { ...this.savedFavorites, shared: saved };
      // A layout with a pending write keeps its unsaved state; the write settles it.
      let shared = saved;
      for (const externalId of this.favoriteWrites.shared.keys()) {
        shared = updateIds(shared, externalId, {
          included: this.favorites.shared.has(externalId),
        });
      }
      this.updateFavorites({ shared });
    } catch (error) {
      log.error("Failed to load remote favorite layouts", error);
    } finally {
      this.sharedFavoriteLoads.delete(savedWhileLoading);
    }
  }

  private async setPersonalFavorite(
    userProfile: UserProfileStorage,
    id: LayoutID,
    { favorite }: { favorite: boolean },
  ): Promise<void> {
    await this.loadPersonalFavorites();
    await this.saveFavorite("personal", id, { favorite }, async () => {
      await userProfile.setUserProfile((profile) => ({
        ...profile,
        favoriteLayoutIds: [
          ...updateIds(new Set(profile.favoriteLayoutIds ?? []), id, { included: favorite }),
        ] as LayoutID[],
      }));
    });
  }

  private async setSharedFavorite(
    remote: IRemoteLayoutFavoritesStorage,
    externalId: string,
    { favorite }: { favorite: boolean },
  ): Promise<void> {
    await this.saveFavorite("shared", externalId, { favorite }, async () => {
      if (favorite) {
        await remote.addFavoriteLayout(externalId);
      } else {
        await remote.removeFavoriteLayout(externalId);
      }
      for (const savedWhileLoading of this.sharedFavoriteLoads) {
        savedWhileLoading.set(externalId, favorite);
      }
    });
  }

  /**
   * Apply a favorite change immediately, then save it after the previous write of the same layout.
   * If it cannot be saved and no newer write of the layout is pending, the layout is rolled back to
   * its saved state.
   */
  private async saveFavorite(
    kind: FavoriteKind,
    id: string,
    { favorite }: { favorite: boolean },
    save: () => Promise<void>,
  ): Promise<void> {
    this.updateFavorites({ [kind]: updateIds(this.favorites[kind], id, { included: favorite }) });

    const writes = this.favoriteWrites[kind];
    const write = (writes.get(id) ?? Promise.resolve()).then(async () => {
      await save();
      this.savedFavorites = {
        ...this.savedFavorites,
        [kind]: updateIds(this.savedFavorites[kind], id, { included: favorite }),
      };
    });
    // The next write of this layout runs after this one, whether it succeeds or fails.
    const settled = write.catch(() => {});
    writes.set(id, settled);
    try {
      await write;
    } catch (error) {
      // Otherwise a newer write of this layout is pending and will settle its state.
      if (writes.get(id) === settled) {
        this.updateFavorites({
          [kind]: updateIds(this.favorites[kind], id, {
            included: this.savedFavorites[kind].has(id),
          }),
        });
      }
      throw error;
    } finally {
      if (writes.get(id) === settled) {
        writes.delete(id);
      }
    }
  }

  /**
   * Attempt to synchronize the local cache with remote storage. At minimum this incurs a fetch of
   * the cached and remote layout lists; it may also involve modifications to the cache, remote
   * storage, or both.
   */
  @emitBusyStatus
  public async syncWithRemote(abortSignal: AbortSignal): Promise<void> {
    if (this.currentSync) {
      log.debug("Layout sync is already in progress");
      await this.currentSync;
      return;
    }
    const start = performance.now();
    try {
      log.debug("Starting layout sync");
      this.currentSync = this.syncWithRemoteImpl(abortSignal);
      await this.currentSync;
      this.notifyChangeListeners({ type: "change", updatedLayout: undefined });
      if (this.error) {
        this.setError(undefined);
      }
    } catch (error) {
      this.setError(error);
      throw error;
    } finally {
      this.currentSync = undefined;
      log.debug(`Completed sync in ${((performance.now() - start) / 1000).toFixed(2)}s`);
    }
  }

  private async syncWithRemoteImpl(abortSignal: AbortSignal): Promise<void> {
    if (!this.remote || !this.isOnline) {
      return;
    }

    const [localLayouts, remoteLayouts] = await Promise.all([
      this.local.runExclusive(async (local) => await local.list()),
      this.remote.getLayouts(),
    ]);

    if (abortSignal.aborted) {
      return;
    }

    const syncOperations = computeLayoutSyncOperations(localLayouts, remoteLayouts);

    const [localOps, remoteOps] = _.partition(
      syncOperations,
      (op): op is typeof op & { local: true } => op.local,
    );
    await Promise.all([
      this.performLocalSyncOperations(localOps, abortSignal),
      this.performRemoteSyncOperations(remoteOps, abortSignal),
    ]);
  }

  private async performLocalSyncOperations(
    operations: readonly (SyncOperation & { local: true })[],
    abortSignal: AbortSignal,
  ): Promise<void> {
    await this.local.runExclusive(async (local) => {
      for (const operation of operations) {
        if (abortSignal.aborted) {
          return;
        }
        switch (operation.type) {
          case "mark-deleted": {
            const { localLayout } = operation;
            log.debug(`Marking layout as remotely deleted: ${localLayout.id}`);
            await local.put({
              ...localLayout,
              syncInfo: { status: "remotely-deleted", lastRemoteSavedAt: undefined },
            });
            break;
          }

          case "delete-local":
            log.debug(
              `Deleting local layout ${operation.localLayout.id}, whose sync status was ${operation.localLayout.syncInfo?.status}`,
            );
            await local.delete(operation.localLayout.id);
            this.notifyChangeListeners({ type: "delete", layoutId: operation.localLayout.id });
            break;

          case "add-to-cache": {
            const { remoteLayout } = operation;
            log.debug(`Adding layout to cache: ${remoteLayout.id}`);
            await local.put({
              id: remoteLayout.id,
              name: remoteLayout.name,
              externalId: remoteLayout.externalId,
              permission: remoteLayout.permission,
              baseline: { data: remoteLayout.data, savedAt: remoteLayout.savedAt },
              working: undefined,
              syncInfo: layoutPermissionIsShared(remoteLayout.permission)
                ? { status: "tracked", lastRemoteSavedAt: remoteLayout.savedAt }
                : undefined,
            });
            break;
          }

          case "update-baseline": {
            const { localLayout, remoteLayout } = operation;
            log.debug(`Updating baseline for ${localLayout.id}`);
            await local.put({
              id: remoteLayout.id,
              externalId: remoteLayout.externalId,
              name: remoteLayout.name,
              permission: remoteLayout.permission,
              baseline: { data: remoteLayout.data, savedAt: remoteLayout.savedAt },
              working: localLayout.working,
              syncInfo: {
                status: localLayout.syncInfo.status,
                lastRemoteSavedAt: remoteLayout.savedAt,
              },
            });
            break;
          }
        }
      }
    });
  }

  private async performRemoteSyncOperations(
    operations: readonly (SyncOperation & { local: false })[],
    abortSignal: AbortSignal,
  ): Promise<void> {
    const remote = this.remote;
    if (!remote) {
      return;
    }

    // Any necessary local cleanups are performed all at once after the server operations, so the
    // server ops can be done without blocking other local sync operations.
    type CleanupFunction = (local: NamespacedLayoutStorage) => Promise<void>;

    const cleanups = await Promise.all(
      operations.map(async (operation): Promise<CleanupFunction> => {
        switch (operation.type) {
          case "delete-remote": {
            const { localLayout } = operation;
            log.debug(`Deleting remote layout ${localLayout.id}`);
            let layoutExistedOnRemote = false;
            if (localLayout.externalId) {
              layoutExistedOnRemote = await remote.deleteLayout(localLayout.externalId);
            }
            if (!layoutExistedOnRemote) {
              log.warn(`Deleting layout ${localLayout.id} which was not present in remote storage`);
            }
            return async (local) => {
              if (abortSignal.aborted) {
                return;
              }
              await local.delete(localLayout.id);
            };
          }

          case "upload-new": {
            const { localLayout } = operation;
            log.debug(`Uploading new layout ${localLayout.id}`);
            const newBaseline = await remote.saveNewLayout({
              id: localLayout.id,
              name: localLayout.name,
              data: localLayout.baseline.data,
              permission: localLayout.permission,
            });
            return async (local) => {
              // Don't check abortSignal; we need the cache to be updated to show the layout is tracked
              await local.put({
                ...localLayout,
                baseline: { ...localLayout.baseline, savedAt: newBaseline.savedAt },
                syncInfo: { status: "tracked", lastRemoteSavedAt: newBaseline.savedAt },
              });
            };
          }

          case "upload-updated": {
            const { localLayout } = operation;
            log.debug(`Uploading updated layout ${localLayout.id}`);
            if (!localLayout.externalId) {
              throw new Error(
                `Cannot update layout ${localLayout.id} (${localLayout.name}) because it has no externalId`,
              );
            }
            const newBaseline = await updateOrFetchLayout(remote, {
              id: localLayout.id,
              externalId: localLayout.externalId,
              name: localLayout.name,
              data: localLayout.baseline.data,
              savedAt:
                localLayout.baseline.savedAt ?? (new Date().toISOString() as ISO8601Timestamp),
            });
            return async (local) => {
              // Don't check abortSignal; we need the cache to be updated to show the layout is tracked
              await local.put({
                ...localLayout,
                name: newBaseline.name,
                baseline: { ...localLayout.baseline, savedAt: newBaseline.savedAt },
                syncInfo: { status: "tracked", lastRemoteSavedAt: newBaseline.savedAt },
              });
            };
          }
        }
      }),
    );

    await this.local.runExclusive(async (local) => {
      await Promise.all(
        cleanups.map(async (cleanup) => {
          await cleanup(local);
        }),
      );
    });
  }
}
