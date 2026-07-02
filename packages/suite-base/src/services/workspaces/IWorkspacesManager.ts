// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Namespace } from "@lichtblick/suite-base/types";

/**
 * A workspace groups the extensions and layouts loaded by the app. Its `namespace` determines the
 * namespace that the workspace's artifacts inherit when loaded (`"local"` for personal workspaces,
 * `"org"` for organization workspaces).
 */
export type Workspace = {
  id: string;
  name: string;
  namespace: Namespace;
};

/**
 * Platform-agnostic service for managing workspaces. The desktop build implements this over the
 * Electron bridge; a future web build could implement it over a remote API.
 */
export interface IWorkspacesManager {
  /** List all available workspaces. */
  list: () => Promise<Workspace[]>;
  /** Create a new workspace and return it. */
  create: (name: string, namespace: Namespace) => Promise<Workspace>;
  /** Rename an existing workspace and return the updated workspace. */
  rename: (id: string, name: string) => Promise<Workspace>;
  /** Delete a workspace and all of its contents. */
  delete: (id: string) => Promise<void>;
  /** Get the currently selected workspace, or undefined when none is selected. */
  getCurrent: () => Promise<Workspace | undefined>;
  /** Select the active workspace (persisted). Pass undefined to select none. */
  setCurrent: (id: string | undefined) => Promise<void>;
}

