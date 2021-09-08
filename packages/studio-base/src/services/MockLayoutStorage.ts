// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ILayoutStorage, Layout } from "@foxglove/studio-base/services/ILayoutStorage";

// ts-prune-ignore-next
export default class MockLayoutStorage implements ILayoutStorage {
  private layoutsByIdByNamespace: Map<string, Map<string, Layout>>;

  constructor(namespace: string, layouts: Layout[] = []) {
    this.layoutsByIdByNamespace = new Map([
      [namespace, new Map(layouts.map((layout) => [layout.id, layout]))],
    ]);
  }

  async list(namespace: string): Promise<readonly Layout[]> {
    return Array.from(this.layoutsByIdByNamespace.get(namespace)?.values() ?? []);
  }

  async get(namespace: string, id: string): Promise<Layout | undefined> {
    return this.layoutsByIdByNamespace.get(namespace)?.get(id);
  }

  async put(namespace: string, layout: Layout): Promise<Layout> {
    let layoutsById = this.layoutsByIdByNamespace.get(namespace);
    if (!layoutsById) {
      layoutsById = new Map();
      this.layoutsByIdByNamespace.set(namespace, layoutsById);
    }
    layoutsById.set(layout.id, layout);
    return layout;
  }

  async delete(namespace: string, id: string): Promise<void> {
    this.layoutsByIdByNamespace.get(namespace)?.delete(id);
  }

  async importLayouts(): Promise<void> {}
}
