// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CachedLayout, ILayoutCache } from "@foxglove/studio-base";

import { Storage } from "../../common/types";

function assertLayout(value: unknown): asserts value is CachedLayout {
  if (typeof value !== "object" || value == undefined) {
    throw new Error("Invariant violation - layout item is not an object");
  }

  if (!("id" in value)) {
    throw new Error("Invariant violation - layout item is missing an id");
  }
}

// Implement a LayoutStorage interface over OsContext
export default class NativeStorageLayoutCache implements ILayoutCache {
  private static STORE_NAME = "layouts";

  private _ctx: Storage;

  constructor(storage: Storage) {
    this._ctx = storage;
  }

  async list(): Promise<readonly CachedLayout[]> {
    const items = await this._ctx.all(NativeStorageLayoutCache.STORE_NAME);

    const layouts: CachedLayout[] = [];
    for (const item of items) {
      if (!(item instanceof Uint8Array)) {
        throw new Error("Invariant violation - layout item is not a buffer");
      }

      const str = new TextDecoder().decode(item);
      const parsed = JSON.parse(str);
      assertLayout(parsed);
      layouts.push(parsed);
    }

    return layouts;
  }

  async get(id: string): Promise<CachedLayout | undefined> {
    const item = await this._ctx.get(NativeStorageLayoutCache.STORE_NAME, id);
    if (item == undefined) {
      return undefined;
    }
    if (!(item instanceof Uint8Array)) {
      throw new Error("Invariant violation - layout item is not a buffer");
    }

    const str = new TextDecoder().decode(item);
    const parsed = JSON.parse(str);
    assertLayout(parsed);

    return parsed;
  }

  async put(layout: CachedLayout): Promise<void> {
    const content = JSON.stringify(layout);
    return await this._ctx.put(NativeStorageLayoutCache.STORE_NAME, layout.id, content);
  }

  async delete(id: string): Promise<void> {
    return await this._ctx.delete(NativeStorageLayoutCache.STORE_NAME, id);
  }
}
