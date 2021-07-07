// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LazilyInitialized } from "@foxglove/den/async";
import { CachedLayout, ILayoutCache } from "@foxglove/studio-base/services/ILayoutCache";

/**
 * A view of ILayoutCache which only calls the underlying list() once, and implements all
 * operations on the cached data in memory as well as writing through to the underlying storage.
 *
 * For this to be useful, we must assume nothing else is accessing the same underlying storage.
 */
export default class WriteThroughLayoutCache implements ILayoutCache {
  private map: LazilyInitialized<Map<string, CachedLayout>>;

  constructor(private cache: ILayoutCache) {
    this.map = new LazilyInitialized(
      async () =>
        await this.cache
          .list()
          .then((layouts) => new Map(layouts.map((layout) => [layout.id, layout]))),
    );
  }

  async list(): Promise<readonly CachedLayout[]> {
    return Array.from((await this.map.get()).values());
  }

  async get(id: string): Promise<CachedLayout | undefined> {
    return (await this.map.get()).get(id);
  }

  async put(layout: CachedLayout): Promise<void> {
    await this.cache.put(layout);
    (await this.map.get()).set(layout.id, layout);
  }

  async delete(id: string): Promise<void> {
    await this.cache.delete(id);
    (await this.map.get()).delete(id);
  }
}
