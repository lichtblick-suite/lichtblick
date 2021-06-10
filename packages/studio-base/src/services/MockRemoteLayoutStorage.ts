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
} from "@foxglove/studio-base/services/LayoutStorage";
import {
  RemoteLayout,
  RemoteLayoutMetadata,
  RemoteLayoutStorage,
} from "@foxglove/studio-base/services/RemoteLayoutStorage";

const FAKE_USER: UserMetadata = {
  id: "fakeuser" as UserID,
  email: "fakeuser@example.com",
  name: "Fake User",
};

export default class MockRemoteLayoutStorage implements RemoteLayoutStorage {
  private layoutsById = new Map<LayoutID, RemoteLayout>();

  async getLayouts(): Promise<RemoteLayoutMetadata[]> {
    return Array.from(this.layoutsById.values(), (layout) => layout.metadata);
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
    for (const { metadata } of this.layoutsById.values()) {
      if (
        isEqual(path, metadata.path) &&
        name === metadata.name &&
        metadata.permission === "creator_write"
      ) {
        return { status: "conflict" };
      }
    }
    const id = uuidv4() as LayoutID;
    const now = new Date().toISOString() as ISO8601Timestamp;
    const newMetadata: RemoteLayoutMetadata = {
      id,
      name,
      path,
      permission: "creator_write",
      creator: FAKE_USER,
      createdAt: now,
      updatedAt: now,
    };
    this.layoutsById.set(id, { data, metadata: newMetadata });
    return { status: "success", newMetadata };
  }

  async updateLayout({
    path,
    name,
    data,
    targetID,
    ifUnmodifiedSince,
  }: {
    path: string[];
    name: string;
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
    if (Date.parse(target.metadata.updatedAt) !== Date.parse(ifUnmodifiedSince)) {
      return { status: "precondition-failed" };
    }
    const now = new Date().toISOString() as ISO8601Timestamp;
    const newMetadata: RemoteLayoutMetadata = {
      ...target.metadata,
      path,
      name,
      updatedAt: now,
    };
    this.layoutsById.set(targetID, { ...target, data, metadata: newMetadata });
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
    for (const { metadata } of this.layoutsById.values()) {
      if (
        isEqual(path, metadata.path) &&
        name === metadata.name &&
        metadata.permission !== "creator_write"
      ) {
        return { status: "conflict" };
      }
    }
    const id = uuidv4() as LayoutID;
    const now = new Date().toISOString() as ISO8601Timestamp;
    const newMetadata: RemoteLayoutMetadata = {
      id,
      name,
      path,
      permission,
      creator: FAKE_USER,
      createdAt: now,
      updatedAt: now,
    };
    this.layoutsById.set(id, { data: source.data, metadata: newMetadata });
    return { status: "success", newMetadata };
  }

  async updateSharedLayout({
    sourceID,
    path,
    name,
    permission,
    targetID,
    ifUnmodifiedSince,
  }: {
    sourceID: LayoutID;
    path: string[];
    name: string;
    permission: "org_read" | "org_write";
    targetID: LayoutID;
    ifUnmodifiedSince: ISO8601Timestamp;
  }): Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "conflict" }
    | { status: "precondition-failed" }
  > {
    const source = this.layoutsById.get(sourceID);
    if (!source) {
      return { status: "conflict" };
    }
    const target = this.layoutsById.get(targetID);
    if (!target) {
      return { status: "conflict" };
    }
    if (Date.parse(target.metadata.updatedAt) !== Date.parse(ifUnmodifiedSince)) {
      return { status: "precondition-failed" };
    }
    const now = new Date().toISOString() as ISO8601Timestamp;
    const newMetadata: RemoteLayoutMetadata = {
      ...target.metadata,
      name,
      path,
      permission,
      updatedAt: now,
    };
    this.layoutsById.set(targetID, { ...target, data: source.data, metadata: newMetadata });
    return { status: "success", newMetadata };
  }

  async deleteLayout({
    id,
    ifUnmodifiedSince,
  }: {
    id: LayoutID;
    ifUnmodifiedSince: ISO8601Timestamp;
  }): Promise<{ status: "success" | "precondition-failed" }> {
    const target = this.layoutsById.get(id);
    if (!target) {
      return { status: "success" };
    }
    if (Date.parse(target.metadata.updatedAt) !== Date.parse(ifUnmodifiedSince)) {
      return { status: "precondition-failed" };
    }
    this.layoutsById.delete(id);
    return { status: "success" };
  }

  async renameLayout({
    id,
    name,
    path,
    ifUnmodifiedSince,
  }: {
    id: LayoutID;
    name: string;
    path: string[];
    ifUnmodifiedSince: ISO8601Timestamp;
  }): Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "conflict" }
    | { status: "precondition-failed" }
  > {
    const target = this.layoutsById.get(id);
    if (!target) {
      return { status: "conflict" };
    }
    return this.updateLayout({ targetID: id, name, path, ifUnmodifiedSince, data: target.data });
  }
}
