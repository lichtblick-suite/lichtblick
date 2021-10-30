// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter, { EventNames, EventListener } from "eventemitter3";
import { partition } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { MutexLocked } from "@foxglove/den/async";
import Logger from "@foxglove/log";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { ISO8601Timestamp } from "@foxglove/studio-base/services/ConsoleApi";
import {
  ILayoutManager,
  LayoutManagerEventTypes,
} from "@foxglove/studio-base/services/ILayoutManager";
import {
  ILayoutStorage,
  Layout,
  layoutAppearsDeleted,
  LayoutID,
  layoutIsShared,
  LayoutPermission,
  layoutPermissionIsShared,
} from "@foxglove/studio-base/services/ILayoutStorage";
import {
  IRemoteLayoutStorage,
  RemoteLayout,
} from "@foxglove/studio-base/services/IRemoteLayoutStorage";
import computeLayoutSyncOperations, {
  SyncOperation,
} from "@foxglove/studio-base/services/LayoutManager/computeLayoutSyncOperations";

const log = Logger.getLogger(__filename);

/**
 * Try to perform the given updateLayout operation on remote storage. If a conflict is returned,
 * fetch the most recent version of the layout and return that instead.
 */
async function updateOrFetchLayout(
  remote: IRemoteLayoutStorage,
  params: Parameters<IRemoteLayoutStorage["updateLayout"]>[0],
): Promise<RemoteLayout> {
  const response = await remote.updateLayout(params);
  switch (response.status) {
    case "success":
      return response.newLayout;
    case "conflict": {
      const remoteLayout = await remote.getLayout(params.id);
      if (!remoteLayout) {
        throw new Error(`Update rejected but layout is not present on server: ${params.id}`);
      }
      log.info(`Layout update rejected, using server version: ${params.id}`);
      return remoteLayout;
    }
  }
}

/**
 * A wrapper around ILayoutStorage for a particular namespace.
 */
class NamespacedLayoutStorage {
  private migration: Promise<void>;
  constructor(
    private storage: ILayoutStorage,
    private namespace: string,
    {
      migrateUnnamespacedLayouts,
      importFromNamespace,
    }: { migrateUnnamespacedLayouts: boolean; importFromNamespace: string | undefined },
  ) {
    this.migration = (async function () {
      if (migrateUnnamespacedLayouts) {
        await storage
          .migrateUnnamespacedLayouts?.(namespace)
          .catch((error) => log.error("Migration failed:", error));
      }

      if (importFromNamespace != undefined) {
        await storage
          .importLayouts({
            fromNamespace: importFromNamespace,
            toNamespace: namespace,
          })
          .catch((error) => log.error("Import failed:", error));
      }
    })();
  }

  async list(): Promise<readonly Layout[]> {
    await this.migration;
    return await this.storage.list(this.namespace);
  }
  async get(id: LayoutID): Promise<Layout | undefined> {
    await this.migration;
    return await this.storage.get(this.namespace, id);
  }
  async put(layout: Layout): Promise<Layout> {
    await this.migration;
    return await this.storage.put(this.namespace, layout);
  }
  async delete(id: LayoutID): Promise<void> {
    await this.migration;
    await this.storage.delete(this.namespace, id);
  }
}

export default class LayoutManager implements ILayoutManager {
  static readonly LOCAL_STORAGE_NAMESPACE = "local";
  static readonly REMOTE_STORAGE_NAMESPACE_PREFIX = "remote-";

  /**
   * All access to storage is wrapped in a mutex to prevent multi-step operations (such as reading
   * and then writing a single layout, or writing one and deleting another) from getting
   * interleaved.
   */
  private local: MutexLocked<NamespacedLayoutStorage>;
  private remote: IRemoteLayoutStorage | undefined;

  readonly supportsSharing: boolean;

  private emitter = new EventEmitter<LayoutManagerEventTypes>();

  private busyCount = 0;

  /**
   * A decorator to emit busy events before and after an async operation so the UI can show that the
   * operation is in progress.
   */
  private static withBusyStatus<Args extends unknown[], Ret>(
    _prototype: typeof LayoutManager.prototype,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(this: LayoutManager, ...args: Args) => Promise<Ret>>,
  ) {
    const method = descriptor.value!;
    descriptor.value = async function (...args) {
      try {
        this.busyCount++;
        this.emitter.emit("busychange");
        return await method.apply(this, args);
      } finally {
        this.busyCount--;
        this.emitter.emit("busychange");
      }
    };
  }

  // eslint-disable-next-line no-restricted-syntax
  get isBusy(): boolean {
    return this.busyCount > 0;
  }

  isOnline = false;

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setOnline(online: boolean): void {
    this.isOnline = online;
    this.emitter.emit("onlinechange");
  }

  constructor({
    local,
    remote,
  }: {
    local: ILayoutStorage;
    remote: IRemoteLayoutStorage | undefined;
  }) {
    this.local = new MutexLocked(
      new NamespacedLayoutStorage(
        local,
        remote
          ? LayoutManager.REMOTE_STORAGE_NAMESPACE_PREFIX + remote.namespace
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
  }

  on<E extends EventNames<LayoutManagerEventTypes>>(
    name: E,
    listener: EventListener<LayoutManagerEventTypes, E>,
  ): void {
    this.emitter.on(name, listener);
  }
  off<E extends EventNames<LayoutManagerEventTypes>>(
    name: E,
    listener: EventListener<LayoutManagerEventTypes, E>,
  ): void {
    this.emitter.off(name, listener);
  }

  private notifyChangeListeners(event: { updatedLayout: Layout | undefined }) {
    queueMicrotask(() => this.emitter.emit("change", event));
  }

  async getLayouts(): Promise<readonly Layout[]> {
    return await this.local.runExclusive(async (local) => {
      const layouts = await local.list();
      return layouts.filter((layout) => !layoutAppearsDeleted(layout));
    });
  }

  async getLayout(id: LayoutID): Promise<Layout | undefined> {
    return await this.local.runExclusive(async (local) => {
      const layout = await local.get(id);
      return layout && !layoutAppearsDeleted(layout) ? layout : undefined;
    });
  }

  @LayoutManager.withBusyStatus
  async saveNewLayout({
    name,
    data,
    permission,
  }: {
    name: string;
    data: PanelsState;
    permission: LayoutPermission;
  }): Promise<Layout> {
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
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      });
      const result = await this.local.runExclusive(
        async (local) =>
          await local.put({
            id: newLayout.id,
            name: newLayout.name,
            permission: newLayout.permission,
            baseline: { data: newLayout.data, savedAt: newLayout.savedAt },
            working: undefined,
            syncInfo: { status: "tracked", lastRemoteSavedAt: newLayout.savedAt },
          }),
      );
      this.notifyChangeListeners({ updatedLayout: undefined });
      return result;
    }

    const newLayout = await this.local.runExclusive(
      async (local) =>
        await local.put({
          id: uuidv4() as LayoutID,
          name,
          permission,
          baseline: { data, savedAt: new Date().toISOString() as ISO8601Timestamp },
          working: undefined,
          syncInfo: this.remote ? { status: "new", lastRemoteSavedAt: undefined } : undefined,
        }),
    );
    this.notifyChangeListeners({ updatedLayout: newLayout });
    return newLayout;
  }

  @LayoutManager.withBusyStatus
  async updateLayout({
    id,
    name,
    data,
  }: {
    id: LayoutID;
    name: string | undefined;
    data: PanelsState | undefined;
  }): Promise<Layout> {
    const now = new Date().toISOString() as ISO8601Timestamp;
    const localLayout = await this.local.runExclusive(async (local) => await local.get(id));
    if (!localLayout) {
      throw new Error(`Cannot update layout ${id} because it does not exist`);
    }

    // Renames of shared layouts go directly to the server
    if (name != undefined && layoutIsShared(localLayout)) {
      if (!this.remote) {
        throw new Error("Shared layouts are not supported without remote layout storage");
      }
      if (!this.isOnline) {
        throw new Error("Cannot update a shared layout while offline");
      }
      const updatedBaseline = await updateOrFetchLayout(this.remote, { id, name, savedAt: now });
      const result = await this.local.runExclusive(
        async (local) =>
          await local.put({
            ...localLayout,
            name: updatedBaseline.name,
            baseline: { data: updatedBaseline.data, savedAt: updatedBaseline.savedAt },
            working: data != undefined ? { data, savedAt: now } : localLayout.working,
            syncInfo: { status: "tracked", lastRemoteSavedAt: updatedBaseline.savedAt },
          }),
      );
      this.notifyChangeListeners({ updatedLayout: result });
      return result;
    } else {
      const result = await this.local.runExclusive(
        async (local) =>
          await local.put({
            ...localLayout,
            name: name ?? localLayout.name,
            working: data != undefined ? { data, savedAt: now } : localLayout.working,

            // If the name is being changed, we will need to upload to the server
            syncInfo:
              this.remote &&
              name != undefined &&
              localLayout.syncInfo &&
              localLayout.syncInfo?.status !== "new"
                ? { status: "updated", lastRemoteSavedAt: localLayout.syncInfo?.lastRemoteSavedAt }
                : localLayout.syncInfo,
          }),
      );
      this.notifyChangeListeners({ updatedLayout: result });
      return result;
    }
  }

  @LayoutManager.withBusyStatus
  async deleteLayout({ id }: { id: LayoutID }): Promise<void> {
    const localLayout = await this.local.runExclusive(async (local) => await local.get(id));
    if (!localLayout) {
      throw new Error(`Cannot update layout ${id} because it does not exist`);
    }
    if (layoutIsShared(localLayout)) {
      if (!this.remote) {
        throw new Error("Shared layouts are not supported without remote layout storage");
      }
      if (localLayout.syncInfo?.status !== "remotely-deleted") {
        if (!this.isOnline) {
          throw new Error("Cannot delete a shared layout while offline");
        }
        await this.remote.deleteLayout(id);
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
        // Don't have remote storage, or already deleted on remote
        await local.delete(id);
      }
    });
    this.notifyChangeListeners({ updatedLayout: undefined });
  }

  @LayoutManager.withBusyStatus
  async overwriteLayout({ id }: { id: LayoutID }): Promise<Layout> {
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
      const updatedBaseline = await updateOrFetchLayout(this.remote, {
        id,
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
      this.notifyChangeListeners({ updatedLayout: result });
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
            syncInfo: this.remote
              ? { status: "updated", lastRemoteSavedAt: localLayout.syncInfo?.lastRemoteSavedAt }
              : localLayout.syncInfo,
          }),
      );
      this.notifyChangeListeners({ updatedLayout: result });
      return result;
    }
  }

  @LayoutManager.withBusyStatus
  async revertLayout({ id }: { id: LayoutID }): Promise<Layout> {
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
    this.notifyChangeListeners({ updatedLayout: result });
    return result;
  }

  @LayoutManager.withBusyStatus
  async makePersonalCopy({ id, name }: { id: LayoutID; name: string }): Promise<Layout> {
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
    this.notifyChangeListeners({ updatedLayout: undefined });
    return result;
  }

  /** Ensures at most one sync operation is in progress at a time */
  private currentSync?: Promise<void>;

  /**
   * Attempt to synchronize the local cache with remote storage. At minimum this incurs a fetch of
   * the cached and remote layout lists; it may also involve modifications to the cache, remote
   * storage, or both.
   */
  @LayoutManager.withBusyStatus
  async syncWithRemote(abortSignal: AbortSignal): Promise<void> {
    if (this.currentSync) {
      log.debug("Layout sync is already in progress");
      return await this.currentSync;
    }
    const start = performance.now();
    try {
      log.debug("Starting layout sync");
      this.currentSync = this.syncWithRemoteImpl(abortSignal);
      await this.currentSync;
      this.notifyChangeListeners({ updatedLayout: undefined });
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
    const [localOps, remoteOps] = partition(
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
            await local.delete(operation.localLayout.id);
            break;

          case "add-to-cache": {
            const { remoteLayout } = operation;
            log.debug(`Adding layout to cache: ${remoteLayout.id}`);
            await local.put({
              id: remoteLayout.id,
              name: remoteLayout.name,
              permission: remoteLayout.permission,
              baseline: { data: remoteLayout.data, savedAt: remoteLayout.savedAt },
              working: undefined,
              syncInfo: { status: "tracked", lastRemoteSavedAt: remoteLayout.savedAt },
            });
            break;
          }

          case "update-baseline": {
            const { localLayout, remoteLayout } = operation;
            log.debug(`Updating baseline for ${localLayout.id}`);
            await local.put({
              id: remoteLayout.id,
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
    const { remote } = this;
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
            if (!(await remote.deleteLayout(localLayout.id))) {
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
              savedAt:
                localLayout.baseline.savedAt ?? (new Date().toISOString() as ISO8601Timestamp),
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
            const newBaseline = await updateOrFetchLayout(remote, {
              id: localLayout.id,
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
      await Promise.all(cleanups.map(async (cleanup) => await cleanup(local)));
    });
  }
}
