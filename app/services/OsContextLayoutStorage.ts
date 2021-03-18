// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OsContext } from "@foxglove-studio/app/OsContext";
import { Layout, LayoutStorage } from "@foxglove-studio/app/context/LayoutStorageContext";

function assertLayout(value: unknown): asserts value is Layout {
  if (typeof value !== "object" || value == undefined) {
    throw new Error("Invariant violation - layout item is not an object");
  }

  if (!("id" in value)) {
    throw new Error("Invariant violation - layout item is missing an id");
  }
}

// Implement a LayoutStorage interface over OsContext
export default class OsContextLayoutStorage implements LayoutStorage {
  private static STORE_NAME = "layouts";

  #ctx: OsContext;

  constructor(osContext: OsContext) {
    this.#ctx = osContext;
  }

  async list(): Promise<Layout[]> {
    const items = await this.#ctx.storage.all(OsContextLayoutStorage.STORE_NAME);

    const layouts: Layout[] = [];
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

  async get(id: string): Promise<Layout | undefined> {
    const item = await this.#ctx.storage.get(OsContextLayoutStorage.STORE_NAME, id);
    if (!(item instanceof Uint8Array)) {
      throw new Error("Invariant violation - layout item is not a buffer");
    }

    const str = new TextDecoder().decode(item);
    const parsed = JSON.parse(str);
    assertLayout(parsed);

    return parsed;
  }

  async put(layout: Layout): Promise<void> {
    const content = JSON.stringify(layout);
    return this.#ctx.storage.put(OsContextLayoutStorage.STORE_NAME, layout.id, content);
  }

  async delete(id: string): Promise<void> {
    return this.#ctx.storage.delete(OsContextLayoutStorage.STORE_NAME, id);
  }
}
