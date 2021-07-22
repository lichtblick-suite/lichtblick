// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import {
  LayoutID,
  ISO8601Timestamp,
  UserID,
  UserMetadata,
} from "@foxglove/studio-base/services/ILayoutStorage";
import {
  RemoteLayout,
  RemoteLayoutMetadata,
  IRemoteLayoutStorage,
} from "@foxglove/studio-base/services/IRemoteLayoutStorage";

export const FAKE_USER: UserMetadata = {
  id: "fakeuser" as UserID,
  email: "fakeuser@example.com",
  name: "Fake User",
};

export default class MockRemoteLayoutStorage implements IRemoteLayoutStorage {
  private layoutsById = new Map<LayoutID, RemoteLayout>();

  constructor(layouts: RemoteLayout[] = []) {
    this.layoutsById = new Map(layouts.map((layout) => [layout.id, layout]));
  }

  private hasNameConflict({
    path,
    name,
    permission,
  }: {
    path: string[];
    name: string;
    permission: "creator_write" | "org_read" | "org_write";
  }) {
    for (const layout of this.layoutsById.values()) {
      if (
        isEqual(path, layout.path) &&
        name === layout.name &&
        (layout.permission === "creator_write") === (permission === "creator_write")
      ) {
        return true;
      }
    }
    return false;
  }

  async getLayouts(): Promise<readonly RemoteLayoutMetadata[]> {
    return Array.from(this.layoutsById.values(), ({ data: _, ...metadata }) => metadata);
  }

  async getLayout(id: LayoutID): Promise<RemoteLayout | undefined> {
    return this.layoutsById.get(id);
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
    if (this.hasNameConflict({ path, name, permission: "creator_write" })) {
      return { status: "conflict" };
    }
    const id = uuidv4() as LayoutID;
    const now = new Date().toISOString() as ISO8601Timestamp;
    const newMetadata: RemoteLayoutMetadata = {
      id,
      name,
      path,
      permission: "creator_write",
      creatorUserId: FAKE_USER.id,
      createdAt: now,
      updatedAt: now,
    };
    this.layoutsById.set(id, { ...newMetadata, data });
    return { status: "success", newMetadata };
  }

  async updateLayout({
    name,
    path,
    data,
    targetID,
    ifUnmodifiedSince,
  }: {
    name: string | undefined;
    path: string[] | undefined;
    data: PanelsState;
    targetID: LayoutID;
    ifUnmodifiedSince: ISO8601Timestamp;
  }): Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "conflict" }
    | { status: "precondition-failed" }
  > {
    const target = this.layoutsById.get(targetID);
    if (!target) {
      return { status: "conflict" };
    }
    if (
      this.hasNameConflict({
        path: path ?? target.path,
        name: name ?? target.name,
        permission: target.permission,
      })
    ) {
      return { status: "conflict" };
    }
    const { data: _, ...targetMetadata } = target;
    if (Date.parse(targetMetadata.updatedAt) !== Date.parse(ifUnmodifiedSince)) {
      return { status: "precondition-failed" };
    }
    const now = new Date().toISOString() as ISO8601Timestamp;
    const newMetadata: RemoteLayoutMetadata = {
      ...targetMetadata,
      name: name ?? targetMetadata.name,
      path: path ?? targetMetadata.path,
      updatedAt: now,
    };
    this.layoutsById.set(targetID, { ...newMetadata, data });
    return { status: "success", newMetadata };
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
  }): Promise<{ status: "success"; newMetadata: RemoteLayoutMetadata } | { status: "conflict" }> {
    const source = this.layoutsById.get(sourceID);
    if (!source) {
      return { status: "conflict" };
    }
    if (this.hasNameConflict({ path, name, permission: "creator_write" })) {
      return { status: "conflict" };
    }
    const id = uuidv4() as LayoutID;
    const now = new Date().toISOString() as ISO8601Timestamp;
    const newMetadata: RemoteLayoutMetadata = {
      id,
      name,
      path,
      permission,
      creatorUserId: FAKE_USER.id,
      createdAt: now,
      updatedAt: now,
    };
    this.layoutsById.set(id, { ...newMetadata, data: source.data });
    return { status: "success", newMetadata };
  }

  async deleteLayout({
    targetID,
    ifUnmodifiedSince,
  }: {
    targetID: LayoutID;
    ifUnmodifiedSince: ISO8601Timestamp;
  }): Promise<{ status: "success" | "precondition-failed" }> {
    const target = this.layoutsById.get(targetID);
    if (!target) {
      return { status: "success" };
    }
    if (Date.parse(target.updatedAt) !== Date.parse(ifUnmodifiedSince)) {
      return { status: "precondition-failed" };
    }
    this.layoutsById.delete(targetID);
    return { status: "success" };
  }

  async renameLayout({
    targetID,
    name,
    path,
    ifUnmodifiedSince,
  }: {
    targetID: LayoutID;
    name: string;
    path: string[];
    ifUnmodifiedSince: ISO8601Timestamp;
  }): Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "conflict" }
    | { status: "precondition-failed" }
  > {
    const target = this.layoutsById.get(targetID);
    if (!target) {
      return { status: "conflict" };
    }
    if (this.hasNameConflict({ path, name, permission: target.permission })) {
      return { status: "conflict" };
    }
    const { data: _, ...targetMetadata } = target;
    if (Date.parse(targetMetadata.updatedAt) !== Date.parse(ifUnmodifiedSince)) {
      return { status: "precondition-failed" };
    }
    const now = new Date().toISOString() as ISO8601Timestamp;
    const newMetadata: RemoteLayoutMetadata = {
      ...targetMetadata,
      name,
      path,
      updatedAt: now,
    };
    this.layoutsById.set(targetID, { ...newMetadata, data: target.data });
    return { status: "success", newMetadata };
  }
}
