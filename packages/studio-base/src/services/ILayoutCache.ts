// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { RemoteLayoutMetadata } from "@foxglove/studio-base/services/IRemoteLayoutStorage";

export type CachedLayout = {
  id: string;
  name: string;
  state: PanelsState | undefined;

  /** Last known metadata from the server for this layout */
  serverMetadata?: RemoteLayoutMetadata;
  /** Whether the user deleted this layout locally, and it should be deleted on the server */
  locallyDeleted?: boolean;
  /** Whether the user modified this layout locally, and it should be uploaded to the server */
  locallyModified?: boolean;
};

export interface ILayoutCache {
  list(): Promise<readonly CachedLayout[]>;
  get(id: string): Promise<CachedLayout | undefined>;
  put(layout: CachedLayout): Promise<void>;
  delete(id: string): Promise<void>;
}
