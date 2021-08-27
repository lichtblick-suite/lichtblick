// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { v4 as uuidv4 } from "uuid";

import { MutexLocked } from "@foxglove/den/async";
import Logger from "@foxglove/log";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { ISO8601Timestamp } from "@foxglove/studio-base/services/ConsoleApi";
import {
  ILayoutManager,
  LayoutChangeListener,
} from "@foxglove/studio-base/services/ILayoutManager";
import { ILayoutStorage, Layout, LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";

const log = Logger.getLogger(__filename);

/**
 * A wrapper around ILayoutStorage for a particular namespace.
 */
class NamespacedLayoutStorage {
  private migration?: Promise<void>;
  constructor(
    private storage: ILayoutStorage,
    private namespace: string,
    { migrateLocalLayouts }: { migrateLocalLayouts: boolean },
  ) {
    if (migrateLocalLayouts) {
      this.migration = storage.migrateLocalLayouts?.(namespace).catch((error) => {
        log.error("Migration failed:", error);
      });
    }
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

  /**
   * All access to storage is wrapped in a mutex to prevent multi-step operations (such as reading
   * and then writing a single layout, or writing one and deleting another) from getting
   * interleaved.
   */
  private storage: MutexLocked<NamespacedLayoutStorage>;

  readonly supportsSharing = false;

  private changeListeners = new Set<LayoutChangeListener>();

  constructor({ storage }: { storage: ILayoutStorage }) {
    this.storage = new MutexLocked(
      new NamespacedLayoutStorage(storage, LayoutManager.LOCAL_STORAGE_NAMESPACE, {
        migrateLocalLayouts: true,
      }),
    );
  }

  addLayoutsChangedListener(listener: LayoutChangeListener): void {
    this.changeListeners.add(listener);
  }
  removeLayoutsChangedListener(listener: LayoutChangeListener): void {
    this.changeListeners.delete(listener);
  }
  private notifyChangeListeners(event: { updatedLayout: Layout | undefined }) {
    queueMicrotask(() => {
      for (const listener of [...this.changeListeners]) {
        listener(event);
      }
    });
  }

  async getLayouts(): Promise<readonly Layout[]> {
    return await this.storage.runExclusive(async (storage) => await storage.list());
  }

  async getLayout(id: LayoutID): Promise<Layout | undefined> {
    return await this.storage.runExclusive(async (storage) => await storage.get(id));
  }

  async saveNewLayout({
    name,
    data,
    permission,
  }: {
    name: string;
    data: PanelsState;
    permission: "creator_write" | "org_read" | "org_write";
  }): Promise<Layout> {
    if (permission !== "creator_write") {
      throw new Error("Sharing is not supported");
    }
    const newLayout = await this.storage.runExclusive(
      async (storage) =>
        await storage.put({
          id: uuidv4() as LayoutID,
          name,
          permission,
          working: undefined,
          baseline: { data, updatedAt: new Date().toISOString() as ISO8601Timestamp },
        }),
    );
    this.notifyChangeListeners({ updatedLayout: newLayout });
    return newLayout;
  }

  async updateLayout({
    id,
    name,
    data,
    permission,
  }: {
    id: LayoutID;
    name: string | undefined;
    data: PanelsState | undefined;
    permission?: "creator_write" | "org_read" | "org_write";
  }): Promise<Layout> {
    if (permission != undefined && permission !== "creator_write") {
      throw new Error("Sharing is not supported");
    }

    const result = await this.storage.runExclusive(async (storage) => {
      const layout = await storage.get(id);
      if (!layout) {
        throw new Error(`Cannot update layout ${id} because it does not exist`);
      }
      const updatedLayout = {
        ...layout,
        name: name ?? layout.name,
        permission: permission ?? layout.permission,
      };
      if (data != undefined) {
        updatedLayout.working = { data, updatedAt: new Date().toISOString() as ISO8601Timestamp };
      }
      return await storage.put(updatedLayout);
    });
    this.notifyChangeListeners({ updatedLayout: result });
    return result;
  }

  async deleteLayout({ id }: { id: LayoutID }): Promise<void> {
    await this.storage.runExclusive(async (storage) => {
      const layout = await storage.get(id);
      if (!layout) {
        log.warn(`Cannot delete layout id ${id} because it does not exist`);
        return;
      }
      await storage.delete(id);
    });
    this.notifyChangeListeners({ updatedLayout: undefined });
  }

  async overwriteLayout({ id }: { id: LayoutID }): Promise<Layout> {
    const result = await this.storage.runExclusive(async (storage) => {
      const layout = await storage.get(id);
      if (!layout) {
        throw new Error(`Cannot overwrite layout id ${id} because it does not exist`);
      }
      return await storage.put({
        ...layout,
        baseline: layout.working ?? layout.baseline,
        working: undefined,
      });
    });
    this.notifyChangeListeners({ updatedLayout: result });
    return result;
  }

  async revertLayout({ id }: { id: LayoutID }): Promise<Layout> {
    const result = await this.storage.runExclusive(async (storage) => {
      const layout = await storage.get(id);
      if (!layout) {
        throw new Error(`Cannot revert layout id ${id} because it does not exist`);
      }
      return await storage.put({
        ...layout,
        working: undefined,
      });
    });
    this.notifyChangeListeners({ updatedLayout: result });
    return result;
  }
}
