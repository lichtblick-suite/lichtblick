// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Layout, LayoutID, ILayoutStorage } from "@foxglove/studio-base";

/**
 * PredefinedLayoutStorage implements the ILayoutStorage interface for a fixed
 * catalog of layouts. Adding, updating, or removing layouts is not supported.
 */
class PredefinedLayoutStorage implements ILayoutStorage {
  private layouts: Map<string, Layout>;

  constructor(layouts: Map<string, Layout>) {
    this.layouts = layouts;
  }

  async list(_namespace: string): Promise<readonly Layout[]> {
    return Array.from(this.layouts.values());
  }

  async get(_namespace: string, id: LayoutID): Promise<Layout | undefined> {
    return this.layouts.get(id);
  }

  async put(_namespace: string, layout: Layout): Promise<Layout> {
    if (!this.layouts.get(layout.id)) {
      throw new Error("Benchmark app only allows updating existing layouts.");
    }
    return layout;
  }

  async delete(_namespace: string, _id: LayoutID): Promise<void> {
    throw new Error("Unsupported");
  }

  async importLayouts(_args: { fromNamespace: string; toNamespace: string }): Promise<void> {}

  async migrateUnnamespacedLayouts(_namespace: string): Promise<void> {}
}

export { PredefinedLayoutStorage };
