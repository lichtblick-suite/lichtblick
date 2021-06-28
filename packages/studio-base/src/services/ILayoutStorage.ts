// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";

// We use "brand" tags to prevent confusion between string types with distinct meanings
// https://github.com/microsoft/TypeScript/issues/4895
export type UserID = string & { __brand: "UserID" };
export type LayoutID = string & { __brand: "LayoutID" };
export type ISO8601Timestamp = string & { __brand: "ISO8601Timestamp" };

export type UserMetadata = {
  id: UserID;
  name: string;
  email: string;
};

/** Metadata that describes a panel layout. */
export type LayoutMetadata = {
  id: LayoutID;
  name: string;
  path: string[];
  creator: UserMetadata | undefined;
  createdAt: ISO8601Timestamp | undefined;
  updatedAt: ISO8601Timestamp | undefined;
  permission: "creator_write" | "org_read" | "org_write";
  data?: never;
};

export type Layout = Omit<LayoutMetadata, "data"> & { data: PanelsState };

export interface ILayoutStorage {
  getLayouts(): Promise<LayoutMetadata[]>;

  getLayout(id: LayoutID): Promise<Layout | undefined>;

  saveNewLayout(params: {
    path: string[];
    name: string;
    data: PanelsState;
  }): Promise<LayoutMetadata>;

  updateLayout(params: {
    targetID: LayoutID;
    name: string | undefined;
    path: string[] | undefined;
    data: PanelsState;
  }): Promise<void>;

  readonly supportsSharing: boolean;

  shareLayout(params: {
    sourceID: LayoutID;
    path: string[];
    name: string;
    permission: "org_read" | "org_write";
  }): Promise<void>;

  updateSharedLayout(params: {
    sourceID: LayoutID;
    path: string[];
    name: string;
    permission: "org_read" | "org_write";
    targetID: LayoutID;
  }): Promise<void>;

  deleteLayout(params: { id: LayoutID }): Promise<void>;

  renameLayout(params: { id: LayoutID; name: string; path: string[] }): Promise<void>;
}
