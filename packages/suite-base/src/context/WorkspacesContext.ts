// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { Workspace } from "@lichtblick/suite-base/services/workspaces/IWorkspacesManager";
import { Namespace } from "@lichtblick/suite-base/types";

/**
 * Value exposed by the workspaces provider. This is the plural `Workspaces` feature (grouping of
 * layouts + extensions) and is distinct from the singular `WorkspaceContext` UI shell state.
 */
export type WorkspacesContextValue = {
  /** All available workspaces. */
  workspaces: Workspace[];
  /** The currently selected workspace, or undefined when using the legacy global folders. */
  currentWorkspace: Workspace | undefined;
  /** Create a new workspace, refresh the list, and return it. */
  createWorkspace: (name: string, namespace: Namespace) => Promise<Workspace>;
  /** Rename a workspace and refresh the list. */
  renameWorkspace: (id: string, name: string) => Promise<void>;
  /** Delete a workspace and refresh the list. */
  deleteWorkspace: (id: string) => Promise<void>;
  /** Switch the active workspace (persists selection and reloads workspace-scoped state). */
  switchWorkspace: (id: string | undefined) => Promise<void>;
  /** Re-read the list of workspaces from disk. */
  refresh: () => Promise<void>;
};

const WorkspacesContext = createContext<WorkspacesContextValue | undefined>(undefined);
WorkspacesContext.displayName = "WorkspacesContext";

/**
 * Access the workspaces feature. Returns undefined when no provider is present (e.g. the web build),
 * so callers can hide workspace UI without throwing.
 */
export function useWorkspaces(): WorkspacesContextValue | undefined {
  return useContext(WorkspacesContext);
}

export default WorkspacesContext;
