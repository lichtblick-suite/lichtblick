// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CachedLayout, ILayoutCache } from "@foxglove/studio-base/services/ILayoutCache";

export default class MockLayoutCache implements ILayoutCache {
  private layoutsById: Map<string, CachedLayout>;

  constructor(layouts: CachedLayout[] = []) {
    this.layoutsById = new Map(layouts.map((layout) => [layout.id, layout]));
  }

  async list(): Promise<readonly CachedLayout[]> {
    return Array.from(this.layoutsById.values());
  }

  async get(id: string): Promise<CachedLayout | undefined> {
    return this.layoutsById.get(id);
  }

  async put(layout: CachedLayout): Promise<void> {
    this.layoutsById.set(layout.id, layout);
  }

  async delete(id: string): Promise<void> {
    this.layoutsById.delete(id);
  }
}
