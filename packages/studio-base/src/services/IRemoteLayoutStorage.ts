// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import {
  ISO8601Timestamp,
  LayoutID,
  LayoutPermission,
} from "@foxglove/studio-base/services/ILayoutStorage";

/**
 * A panel layout stored on a remote server.
 */
export type RemoteLayout = {
  id: LayoutID;
  name: string;
  permission: LayoutPermission;
  data: PanelsState;
  savedAt: ISO8601Timestamp | undefined;
};

export interface IRemoteLayoutStorage {
  /**
   * A namespace corresponding to the logged-in user. Used by the LayoutManager to organize cached
   * layouts on disk.
   */
  readonly namespace: string;

  getLayouts: () => Promise<readonly RemoteLayout[]>;

  getLayout: (id: LayoutID) => Promise<RemoteLayout | undefined>;

  saveNewLayout: (params: {
    id: LayoutID | undefined;
    name: string;
    data: PanelsState;
    permission: LayoutPermission;
    savedAt: ISO8601Timestamp;
  }) => Promise<RemoteLayout>;

  updateLayout: (params: {
    id: LayoutID;
    name?: string;
    data?: PanelsState;
    permission?: LayoutPermission;
    savedAt: ISO8601Timestamp;
  }) => Promise<{ status: "success"; newLayout: RemoteLayout } | { status: "conflict" }>;

  /** Returns true if the layout existed and was deleted, false if the layout did not exist. */
  deleteLayout: (id: LayoutID) => Promise<boolean>;
}
