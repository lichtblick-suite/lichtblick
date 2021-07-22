// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import {
  ISO8601Timestamp,
  LayoutID,
  LayoutMetadata,
} from "@foxglove/studio-base/services/ILayoutStorage";

/**
 * Metadata that describes a panel layout on a remote server.
 *
 * @note Optional values in `LayoutMetadata` are required when layouts are loaded from a server, to
 * enable permissions and consistency checks.
 */
export type RemoteLayoutMetadata = {
  [K in keyof Omit<LayoutMetadata, "data" | "hasUnsyncedChanges" | "conflict">]-?: NonNullable<
    LayoutMetadata[K]
  >;
};

/**
 * A panel layout stored on a remote server.
 */
export type RemoteLayout = Omit<RemoteLayoutMetadata, "data"> & { data: PanelsState };

export interface IRemoteLayoutStorage {
  getLayouts: () => Promise<readonly RemoteLayoutMetadata[]>;

  getLayout: (id: LayoutID) => Promise<RemoteLayout | undefined>;

  saveNewLayout: (params: {
    path: string[];
    name: string;
    data: PanelsState;
  }) => Promise<{ status: "success"; newMetadata: RemoteLayoutMetadata } | { status: "conflict" }>;

  updateLayout: (params: {
    targetID: LayoutID;
    path: string[];
    name: string;
    data: PanelsState;
    ifUnmodifiedSince: ISO8601Timestamp;
  }) => Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "not-found" }
    | { status: "conflict" }
    | { status: "precondition-failed" }
  >;

  shareLayout: (params: {
    sourceID: LayoutID;
    path: string[];
    name: string;
    permission: "org_read" | "org_write";
  }) => Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "not-found" }
    | { status: "conflict" }
  >;

  deleteLayout: (params: {
    targetID: LayoutID;
    ifUnmodifiedSince: ISO8601Timestamp;
  }) => Promise<{ status: "success" | "precondition-failed" }>;

  renameLayout: (params: {
    targetID: LayoutID;
    name: string;
    path: string[];
    ifUnmodifiedSince: ISO8601Timestamp;
  }) => Promise<
    | { status: "success"; newMetadata: RemoteLayoutMetadata }
    | { status: "not-found" }
    | { status: "conflict" }
    | { status: "precondition-failed" }
  >;
}
