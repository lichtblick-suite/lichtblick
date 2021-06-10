// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { v4 as uuidv4 } from "uuid";

import Logger from "@foxglove/log";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import {
  Layout,
  LayoutID,
  LayoutMetadata,
  LayoutStorage,
} from "@foxglove/studio-base/services/LayoutStorage";
import { LocalLayout, LocalLayoutStorage } from "@foxglove/studio-base/services/LocalLayoutStorage";

const log = Logger.getLogger(__filename);

function getMetadata(layout: LocalLayout): LayoutMetadata {
  if (layout.serverMetadata) {
    log.warn(`Local-only layout ${layout.id} has unexpected server metadata`);
  }
  return {
    id: layout.id as LayoutID,
    name: layout.name,
    path: [],
    creator: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    permission: "creator_write",
  };
}

/**
 * A LayoutStorage that's backed solely by a LocalLayoutStorage. This is used when centralized
 * layout storage is not available because the user is not logged in to an account.
 *
 * Any `serverMetadata` on the local layout is ignored and generally is not expected to be present.
 */
export default class LocalOnlyLayoutStorage implements LayoutStorage {
  supportsSharing = false;

  constructor(private storage: LocalLayoutStorage) {}

  async getLayouts(): Promise<LayoutMetadata[]> {
    return (await this.storage.list()).map(getMetadata);
  }

  async getLayout(id: LayoutID): Promise<Layout | undefined> {
    const localLayout = await this.storage.get(id);
    if (!localLayout || !localLayout.state) {
      return undefined;
    }
    return {
      name: localLayout.name,
      data: localLayout.state,
      metadata: getMetadata(localLayout),
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
    if (path.length !== 0) {
      throw new Error("Layout paths are not supported in local-only storage");
    }
    const id = uuidv4() as LayoutID;
    await this.storage.put({ id, name, state: data });
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
    if (path.length !== 0) {
      throw new Error("Layout paths are not supported in local-only storage");
    }
    await this.storage.put({ id: targetID, name, state: data });
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
    if (path.length !== 0) {
      throw new Error("Layout paths are not supported in local-only storage");
    }
    const target = await this.storage.get(id);
    if (!target) {
      throw new Error(`Layout id ${id} not found`);
    }
    await this.storage.put({ id, name, state: target.state });
  }
}
