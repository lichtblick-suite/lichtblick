// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { filterMap } from "@foxglove/den/collection";
import Logger from "@foxglove/log";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import ConsoleApi, { ConsoleApiLayout } from "@foxglove/studio-base/services/ConsoleApi";
import { LayoutID, ISO8601Timestamp } from "@foxglove/studio-base/services/ILayoutStorage";
import {
  IRemoteLayoutStorage,
  RemoteLayout,
} from "@foxglove/studio-base/services/IRemoteLayoutStorage";

const log = Logger.getLogger(__filename);

function convertLayout({ id, name, permission, data, saved_at }: ConsoleApiLayout): RemoteLayout {
  if (data == undefined) {
    throw new Error(`Missing data for server layout ${name} (${id})`);
  }
  return { id, name, permission, data: data as PanelsState, savedAt: saved_at };
}

export default class ConsoleApiRemoteLayoutStorage implements IRemoteLayoutStorage {
  constructor(readonly namespace: string, private api: ConsoleApi) {}

  async getLayouts(): Promise<readonly RemoteLayout[]> {
    return filterMap(await this.api.getLayouts({ includeData: true }), (layout) => {
      try {
        return convertLayout(layout);
      } catch (err) {
        log.warn(err);
        return undefined;
      }
    });
  }
  async getLayout(id: LayoutID): Promise<RemoteLayout | undefined> {
    const layout = await this.api.getLayout(id, { includeData: true });
    return layout ? convertLayout(layout) : undefined;
  }

  async saveNewLayout({
    id,
    name,
    data,
    permission,
    savedAt,
  }: {
    id: LayoutID | undefined;
    name: string;
    data: PanelsState;
    permission: "creator_write" | "org_read" | "org_write";
    savedAt: ISO8601Timestamp;
  }): Promise<RemoteLayout> {
    const result = await this.api.createLayout({ id, name, data, permission, saved_at: savedAt });
    return convertLayout(result);
  }

  async updateLayout({
    id,
    name,
    data,
    permission,
    savedAt,
  }: {
    id: LayoutID;
    name?: string;
    data?: PanelsState;
    permission?: "creator_write" | "org_read" | "org_write";
    savedAt: ISO8601Timestamp;
  }): Promise<{ status: "success"; newLayout: RemoteLayout } | { status: "conflict" }> {
    const result = await this.api.updateLayout({ id, name, data, permission, saved_at: savedAt });
    switch (result.status) {
      case "success":
        return { status: "success", newLayout: convertLayout(result.newLayout) };
      case "conflict":
        return result;
    }
  }

  async deleteLayout(id: LayoutID): Promise<boolean> {
    return await this.api.deleteLayout(id);
  }
}
