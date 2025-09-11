// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutData, LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  ISO8601Timestamp,
  Layout,
  LayoutPermission,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import { RemoteLayout } from "@lichtblick/suite-base/services/IRemoteLayoutStorage";

export type SaveNewLayout = Pick<Layout, "name" | "data" | "permission" | "externalId"> & {
  id: LayoutID | undefined;
  savedAt: ISO8601Timestamp;
};

export type UpdateLayoutRequest = {
  id: LayoutID;
  externalId: string;
  name?: string;
  data?: LayoutData;
  permission?: LayoutPermission;
  savedAt: ISO8601Timestamp;
};

export type UpdateLayoutResponse =
  | { status: "success"; newLayout: RemoteLayout }
  | { status: "conflict" };

export type RemoteLayoutResponse = {
  data: RemoteLayoutResponseData[];
};

export type RemoteLayoutResponseData = {
  id: string;
  data: LayoutData;
  name: string;
  layoutId: LayoutID;
  namespace: string;
  permission: LayoutPermission;
  from: string;
  createdBy: string;
  updatedBy: string;
};
