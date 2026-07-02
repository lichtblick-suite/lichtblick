// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { WorkspaceNamespace } from "./types";

/** Root folder for all Lichtblick user data on disk. */
export const SUITE_ROOT_FOLDER = ".lichtblick-suite";

/** Legacy (global) sub-folders kept as a fallback when no workspace is selected. */
export const LEGACY_EXTENSIONS_FOLDER = "extensions";
export const LEGACY_LAYOUTS_FOLDER = "layouts";

/** Workspaces live under `<home>/.lichtblick-suite/workspaces`. */
export const WORKSPACES_FOLDER = "workspaces";

/** Per-workspace sub-folders. */
export const WORKSPACE_EXTENSIONS_FOLDER = "extensions";
export const WORKSPACE_LAYOUTS_FOLDER = "layouts";

/** Name of the per-workspace config file. */
export const WORKSPACE_CONFIG_FILE = "workspace.json";

/** Name of the file holding the currently selected workspace id. */
export const WORKSPACES_STATE_FILE = "state.json";

/** Persisted shape of a workspace's `workspace.json`. */
export type WorkspaceConfig = {
  id: string;
  name: string;
  namespace: WorkspaceNamespace;
  createdAt: string;
  updatedAt: string;
};

/** Persisted shape of `workspaces/state.json`. */
export type WorkspacesState = {
  currentWorkspaceId?: string;
};
