// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LazilyInitialized } from "@foxglove/den/async";
import { LayoutID } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { ILayoutStorage, Layout } from "@foxglove/studio-base/services/ILayoutStorage";

/**
 * A view of ILayoutCache which only calls the underlying list() once per namespace, and implements
 * all operations on the cached data in memory as well as writing through to the underlying storage.
 *
 * For this to be useful, we must assume nothing else is accessing the same underlying storage.
 */
export default class WriteThroughLayoutCache implements ILayoutStorage {
  #cacheByNamespace = new Map<string, LazilyInitialized<Map<string, Layout>>>();

  public constructor(private storage: ILayoutStorage) {}

  #getOrCreateCache(namespace: string): LazilyInitialized<Map<string, Layout>> {
    let cache = this.#cacheByNamespace.get(namespace);
    if (!cache) {
      cache = new LazilyInitialized(
        async () =>
          await this.storage
            .list(namespace)
            .then((layouts) => new Map(layouts.map((layout) => [layout.id, layout]))),
      );
      this.#cacheByNamespace.set(namespace, cache);
    }
    return cache;
  }

  public async importLayouts(params: {
    fromNamespace: string;
    toNamespace: string;
  }): Promise<void> {
    return await this.storage.importLayouts(params);
  }

  public async migrateUnnamespacedLayouts(namespace: string): Promise<void> {
    await this.storage.migrateUnnamespacedLayouts?.(namespace);
  }

  public async list(namespace: string): Promise<readonly Layout[]> {
    return Array.from((await this.#getOrCreateCache(namespace).get()).values());
  }

  public async get(namespace: string, id: LayoutID): Promise<Layout | undefined> {
    return (await this.#getOrCreateCache(namespace).get()).get(id);
  }

  public async put(namespace: string, layout: Layout): Promise<Layout> {
    const result = await this.storage.put(namespace, layout);
    (await this.#getOrCreateCache(namespace).get()).set(result.id, result);
    return result;
  }

  public async delete(namespace: string, id: LayoutID): Promise<void> {
    await this.storage.delete(namespace, id);
    (await this.#getOrCreateCache(namespace).get()).delete(id);
  }
}
