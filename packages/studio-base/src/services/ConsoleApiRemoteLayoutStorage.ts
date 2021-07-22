// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@foxglove/log";
import { PanelsState } from "@foxglove/studio-base/";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";
import { LayoutID, ISO8601Timestamp } from "@foxglove/studio-base/services/ILayoutStorage";
import {
  IRemoteLayoutStorage,
  RemoteLayout,
  RemoteLayoutMetadata,
} from "@foxglove/studio-base/services/IRemoteLayoutStorage";

const log = Logger.getLogger(__filename);

export default class ConsoleApiRemoteLayoutStorage implements IRemoteLayoutStorage {
  constructor(private api: ConsoleApi) {}

  async getLayouts(): Promise<readonly RemoteLayoutMetadata[]> {
    return (await this.api.getLayouts({ includeData: false })) as readonly RemoteLayoutMetadata[];
  }
  async getLayout(id: LayoutID): Promise<RemoteLayout | undefined> {
    return (await this.api.getLayout(id, { includeData: true })) as RemoteLayout | undefined;
  }

  async saveNewLayout({
    path,
    name,
    data,
  }: {
    path: string[];
    name: string;
    data: PanelsState;
  }): Promise<{ status: "success"; newMetadata: RemoteLayoutMetadata } | { status: "conflict" }> {
    try {
      const result = await this.api.createLayout({
        path,
        name,
        data,
        permission: "creator_write",
      });
      return { status: "success", newMetadata: result };
    } catch (err) {
      log.warn(err);
      return { status: "conflict" };
    }
  }

  async updateLayout({
    targetID,
    path,
    name,
    data,
    ifUnmodifiedSince,
  }: {
    targetID: LayoutID;
    path: string[];
    name: string;
    data?: PanelsState;
    ifUnmodifiedSince: ISO8601Timestamp;
  }): Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "not-found" }
    | { status: "conflict" }
    | { status: "precondition-failed" }
  > {
    try {
      const existingLayout = await this.api.getLayout(targetID, { includeData: false });
      if (!existingLayout) {
        return { status: "not-found" };
      }
      if (existingLayout.updatedAt !== ifUnmodifiedSince) {
        return { status: "precondition-failed" };
      }
      const result = await this.api.updateLayout({
        id: targetID,
        path,
        name,
        data,
      });
      return { status: "success", newMetadata: result };
    } catch (err) {
      log.warn(err);
      return { status: "conflict" };
    }
  }

  async shareLayout({
    sourceID,
    path,
    name,
    permission,
  }: {
    sourceID: LayoutID;
    path: string[];
    name: string;
    permission: "org_read" | "org_write";
  }): Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "not-found" }
    | { status: "conflict" }
  > {
    try {
      const existingLayout = await this.api.getLayout(sourceID, { includeData: true });
      if (!existingLayout || !existingLayout.data) {
        return { status: "not-found" };
      }
      const result = await this.api.createLayout({
        path,
        name,
        data: existingLayout.data,
        permission,
      });
      return { status: "success", newMetadata: result };
    } catch (err) {
      log.warn(err);
      return { status: "conflict" };
    }
  }

  async deleteLayout({
    targetID,
  }: {
    targetID: LayoutID;
    ifUnmodifiedSince: ISO8601Timestamp;
  }): Promise<{ status: "success" | "precondition-failed" }> {
    await this.api.deleteLayout(targetID);
    return { status: "success" };
  }

  async renameLayout(params: {
    targetID: LayoutID;
    name: string;
    path: string[];
    ifUnmodifiedSince: ISO8601Timestamp;
  }): Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "not-found" }
    | { status: "conflict" }
    | { status: "precondition-failed" }
  > {
    return await this.updateLayout(params);
  }
}
