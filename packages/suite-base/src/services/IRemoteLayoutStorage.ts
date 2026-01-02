// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  SaveNewLayoutParams,
  UpdateLayoutRequest,
  UpdateLayoutResponse,
} from "@lichtblick/suite-base/api/layouts/types";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { ISO8601Timestamp, LayoutPermission } from "@lichtblick/suite-base/services/ILayoutStorage";

/**
 * A panel layout stored on a remote server.
 */
export type RemoteLayout = {
  id: LayoutID;
  name: string;
  permission: LayoutPermission;
  data: LayoutData;
  savedAt: ISO8601Timestamp | undefined;
  externalId: string;
};
export interface IRemoteLayoutStorage {
  /**
   * A namespace corresponding to the logged-in user. Used by the LayoutManager to organize cached
   * layouts on disk.
   */
  readonly workspace: string;

  getLayouts: () => Promise<readonly RemoteLayout[]>;

  getLayout: (id: LayoutID) => Promise<RemoteLayout | undefined>;

  saveNewLayout: (params: SaveNewLayoutParams) => Promise<RemoteLayout>;

  updateLayout: (params: UpdateLayoutRequest) => Promise<UpdateLayoutResponse>;

  /** Returns true if the layout existed and was deleted, false if the layout did not exist. */
  deleteLayout: (id: string) => Promise<boolean>;
}
