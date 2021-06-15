// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { v4 as uuidv4 } from "uuid";

import Logger from "@foxglove/log";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { CachedLayout, ILayoutCache } from "@foxglove/studio-base/services/ILayoutCache";
import {
  Layout,
  LayoutID,
  LayoutMetadata,
  ILayoutStorage,
} from "@foxglove/studio-base/services/ILayoutStorage";

const log = Logger.getLogger(__filename);

function getMetadata(layout: CachedLayout): LayoutMetadata {
  if (layout.serverMetadata) {
    log.warn(`Local-only layout ${layout.id} has unexpected server metadata`);
  }
  return {
    id: layout.id as LayoutID,
    name: layout.name,
    path: layout.path ?? [],
    creator: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    permission: "creator_write",
  };
}

/**
 * A ILayoutStorage that's backed solely by an ILayoutCache. This is used when centralized
 * layout storage is not available because the user is not logged in to an account.
 *
 * Any `serverMetadata` on the local layout is ignored and generally is not expected to be present.
 */
export default class CacheOnlyLayoutStorage implements ILayoutStorage {
  supportsSharing = false;

  constructor(private storage: ILayoutCache) {}

  async getLayouts(): Promise<LayoutMetadata[]> {
    return (await this.storage.list()).map(getMetadata);
  }

  async getLayout(id: LayoutID): Promise<Layout | undefined> {
    const cachedLayout = await this.storage.get(id);
    if (!cachedLayout || !cachedLayout.state) {
      return undefined;
    }
    return {
      ...getMetadata(cachedLayout),
      data: cachedLayout.state,
    };
  }

  async saveNewLayout({
    path,
    name,
    data,
  }: {
    path: string[];
    name: string;
    data: PanelsState;
  }): Promise<void> {
    const id = uuidv4() as LayoutID;
    await this.storage.put({ id, name, path, state: data });
  }

  async updateLayout({
    path,
    name,
    data,
    targetID,
  }: {
    path: string[];
    name: string;
    data: PanelsState;
    targetID: LayoutID;
  }): Promise<void> {
    await this.storage.put({ id: targetID, name, path, state: data });
  }

  async shareLayout(_: unknown): Promise<void> {
    throw new Error("Sharing is not supported in local-only storage");
  }

  async updateSharedLayout(_: unknown): Promise<void> {
    throw new Error("Sharing is not supported in local-only storage");
  }

  async deleteLayout({ id }: { id: LayoutID }): Promise<void> {
    await this.storage.delete(id);
  }

  async renameLayout({
    id,
    name,
    path,
  }: {
    id: LayoutID;
    name: string;
    path: string[];
  }): Promise<void> {
    const target = await this.storage.get(id);
    if (!target) {
      throw new Error(`Layout id ${id} not found`);
    }
    await this.storage.put({ id, name, path, state: target.state });
  }
}
