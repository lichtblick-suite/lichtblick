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

export type ConflictType =
  | "local-delete-remote-update"
  | "local-update-remote-delete"
  | "both-update"
  | "name-collision";

/** Metadata that describes a panel layout. */
export type LayoutMetadata = {
  id: LayoutID;
  name: string;
  creatorUserId: UserID | undefined;
  createdAt: ISO8601Timestamp | undefined;
  updatedAt: ISO8601Timestamp | undefined;
  permission: "creator_write" | "org_read" | "org_write";
  /**
   * Indicates whether changes have been made to the user's copy of this layout that have yet to be
   * saved. Save the changes by calling ILayoutStorage.syncLayout().
   */
  hasUnsyncedChanges: boolean;
  conflict: ConflictType | undefined;
  data?: never;
};

export type Layout = Omit<LayoutMetadata, "data"> & { data: PanelsState };

export interface ILayoutStorage {
  addLayoutsChangedListener(listener: () => void): void;
  removeLayoutsChangedListener(listener: () => void): void;

  getLayouts(): Promise<LayoutMetadata[]>;

  getLayout(id: LayoutID): Promise<Layout | undefined>;

  saveNewLayout(params: {
    name: string;
    data: PanelsState;
    permission: "creator_write" | "org_read" | "org_write";
  }): Promise<LayoutMetadata>;

  updateLayout(params: {
    targetID: LayoutID;
    name?: string;
    data?: PanelsState;
    permission?: "creator_write" | "org_read" | "org_write";
  }): Promise<void>;

  readonly supportsSyncing: boolean;

  syncLayout(
    id: LayoutID,
  ): Promise<{ status: "success"; newId?: LayoutID } | { status: "conflict"; type: ConflictType }>;

  readonly supportsSharing: boolean;

  deleteLayout(params: { id: LayoutID }): Promise<void>;
}
