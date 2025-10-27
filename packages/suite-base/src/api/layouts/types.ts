// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayoutData, LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  ISO8601Timestamp,
  Layout,
  LayoutPermission,
} from "@lichtblick/suite-base/services/ILayoutStorage";
import { RemoteLayout } from "@lichtblick/suite-base/services/IRemoteLayoutStorage";

// =============================================================================
// API Data Transfer Objects (DTOs)
// =============================================================================

/**
 * Layout data returned from the server API
 */
export interface LayoutApiData {
  /** Server-generated unique identifier */
  id: string;
  /** Layout identifier used by the client */
  layoutId: LayoutID;
  /** Human-readable layout name */
  name: string;
  /** Layout configuration data */
  data: LayoutData;
  /** User workspace */
  workspace: string;
  /** Permission level for the layout */
  permission: LayoutPermission;
  /** Source or origin information */
  from: string;
  /** User who created the layout */
  createdBy: string;
  /** User who last updated the layout */
  updatedBy: string;
}

// =============================================================================
// API Request Types
// =============================================================================

/**
 * Request payload for creating a new layout
 */
export interface CreateLayoutRequest {
  /** Layout identifier */
  layoutId: LayoutID;
  /** Human-readable layout name */
  name: string;
  /** Layout configuration data */
  data: LayoutData;
  /** Permission level for the layout */
  permission: LayoutPermission;
  /** User workspace */
  workspace: string;
}

/**
 * Request payload for updating an existing layout
 */
export interface UpdateLayoutRequest {
  /** Client-side layout identifier */
  id: LayoutID;
  /** Server-side external identifier */
  externalId: string;
  /** Updated layout name (optional) */
  name?: string;
  /** Updated layout data (optional) */
  data?: LayoutData;
  /** Updated permission level (optional) */
  permission?: LayoutPermission;
  /** Timestamp when the layout was saved */
  savedAt: ISO8601Timestamp;
}

/**
 * Request body for updating an existing layout via HTTP
 */
export interface UpdateLayoutRequestBody {
  /** Updated layout name */
  name?: string;
  /** Updated layout data */
  data?: LayoutData;
  /** Updated permission level */
  permission?: LayoutPermission;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Response from layout update operation
 */
export type UpdateLayoutResponse =
  | { status: "success"; newLayout: RemoteLayout }
  | { status: "conflict" };

/**
 * Response from layout creation/update operations containing server data
 */
export type LayoutApiResponse = LayoutApiData;

// =============================================================================
// Service Layer Types
// =============================================================================

/**
 * Parameters for saving a new layout (service layer)
 */
export type SaveNewLayoutParams = Pick<Layout, "id" | "name" | "permission"> & {
  /** New layout data */
  data: LayoutData;
};
