// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@foxglove/log";
import { Layout, ILayoutStorage, LayoutID, migrateLayout } from "@foxglove/studio-base";

import { Storage } from "../../common/types";

const log = Log.getLogger(__filename);

function parseAndMigrateLayout(item: string | Uint8Array): Layout {
  if (!(item instanceof Uint8Array)) {
    throw new Error("Invariant violation - layout item is not a buffer");
  }

  const str = new TextDecoder().decode(item);
  const parsed = JSON.parse(str);
  return migrateLayout(parsed);
}

// Implement a LayoutStorage interface over OsContext
export default class NativeStorageLayoutStorage implements ILayoutStorage {
  private static STORE_PREFIX = "layouts-";
  private static LEGACY_STORE_NAME = "layouts";

  #ctx: Storage;

  public constructor(storage: Storage) {
    this.#ctx = storage;
  }

  public async list(namespace: string): Promise<readonly Layout[]> {
    const items = await this.#ctx.all(NativeStorageLayoutStorage.STORE_PREFIX + namespace);

    const layouts: Layout[] = [];
    for (const item of items) {
      try {
        layouts.push(parseAndMigrateLayout(item));
      } catch (err) {
        log.error(err);
      }
    }

    return layouts;
  }

  public async get(namespace: string, id: LayoutID): Promise<Layout | undefined> {
    const item = await this.#ctx.get(NativeStorageLayoutStorage.STORE_PREFIX + namespace, id);
    if (item == undefined) {
      return undefined;
    }
    return parseAndMigrateLayout(item);
  }

  public async put(namespace: string, layout: Layout): Promise<Layout> {
    const content = JSON.stringify(layout) ?? "";
    await this.#ctx.put(NativeStorageLayoutStorage.STORE_PREFIX + namespace, layout.id, content);
    return layout;
  }

  public async delete(namespace: string, id: LayoutID): Promise<void> {
    return await this.#ctx.delete(NativeStorageLayoutStorage.STORE_PREFIX + namespace, id);
  }

  public async importLayouts({
    fromNamespace,
    toNamespace,
  }: {
    fromNamespace: string;
    toNamespace: string;
  }): Promise<void> {
    const keys = await this.#ctx.list(NativeStorageLayoutStorage.STORE_PREFIX + fromNamespace);
    for (const key of keys) {
      try {
        const item = await this.#ctx.get(
          NativeStorageLayoutStorage.STORE_PREFIX + fromNamespace,
          key,
        );
        if (item == undefined) {
          continue;
        }
        const layout = parseAndMigrateLayout(item);
        await this.put(toNamespace, layout);
        await this.#ctx.delete(NativeStorageLayoutStorage.STORE_PREFIX + fromNamespace, key);
      } catch (error) {
        log.error(error);
      }
    }
  }

  public async migrateUnnamespacedLayouts(namespace: string): Promise<void> {
    // Layouts were previously stored in a single un-namespaced store named "layouts".
    const items = await this.#ctx.all(NativeStorageLayoutStorage.LEGACY_STORE_NAME);
    for (const item of items) {
      if (!(item instanceof Uint8Array)) {
        continue;
      }

      try {
        const str = new TextDecoder().decode(item);
        const parsed = JSON.parse(str);
        const layout = migrateLayout(parsed);
        await this.#ctx.put(
          NativeStorageLayoutStorage.STORE_PREFIX + namespace,
          layout.id,
          JSON.stringify(layout) ?? "",
        );
        await this.#ctx.delete(NativeStorageLayoutStorage.LEGACY_STORE_NAME, layout.id);
      } catch (err) {
        log.error(err);
      }
    }
  }
}
