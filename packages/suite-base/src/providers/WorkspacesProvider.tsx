// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";

import Logger from "@lichtblick/log";
import WorkspacesContext, {
  WorkspacesContextValue,
} from "@lichtblick/suite-base/context/WorkspacesContext";
import {
  IWorkspacesManager,
  Workspace,
} from "@lichtblick/suite-base/services/workspaces/IWorkspacesManager";
import { Namespace } from "@lichtblick/suite-base/types";

const log = Logger.getLogger(__filename);

type Props = PropsWithChildren<{
  /**
   * Service backing the workspaces feature. When undefined (e.g. the web build) the provider renders
   * children without a context value so workspace UI stays hidden.
   */
  manager?: IWorkspacesManager;
  /** Currently selected workspace id, owned by the host so it can drive the keyed remount. */
  currentWorkspaceId?: string;
  /**
   * Called after the selection is persisted (switch or deletion of the active workspace) so the host
   * can re-read the authoritative current workspace and remount the workspace-scoped subtree.
   */
  onSwitchWorkspace?: () => void;
}>;

export default function WorkspacesProvider(props: Props): React.JSX.Element {
  const { manager, currentWorkspaceId, onSwitchWorkspace, children } = props;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const refresh = useCallback(async () => {
    if (!manager) {
      return;
    }
    try {
      setWorkspaces(await manager.list());
    } catch (err: unknown) {
      log.error("Failed to list workspaces", err);
    }
  }, [manager]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createWorkspace = useCallback(
    async (name: string, namespace: Namespace): Promise<Workspace> => {
      if (!manager) {
        throw new Error("No workspaces manager available");
      }
      const workspace = await manager.create(name, namespace);
      await refresh();
      return workspace;
    },
    [manager, refresh],
  );

  const renameWorkspace = useCallback(
    async (id: string, name: string): Promise<void> => {
      if (!manager) {
        throw new Error("No workspaces manager available");
      }
      await manager.rename(id, name);
      await refresh();
    },
    [manager, refresh],
  );

  const deleteWorkspace = useCallback(
    async (id: string): Promise<void> => {
      if (!manager) {
        throw new Error("No workspaces manager available");
      }
      await manager.delete(id);
      await refresh();
      // Deleting the active workspace falls back to the legacy folders (cleared by the manager).
      if (id === currentWorkspaceId) {
        onSwitchWorkspace?.();
      }
    },
    [manager, refresh, currentWorkspaceId, onSwitchWorkspace],
  );

  const switchWorkspace = useCallback(
    async (id: string | undefined): Promise<void> => {
      if (!manager) {
        throw new Error("No workspaces manager available");
      }
      if (id === currentWorkspaceId) {
        return;
      }
      await manager.setCurrent(id);
      onSwitchWorkspace?.();
    },
    [manager, currentWorkspaceId, onSwitchWorkspace],
  );

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === currentWorkspaceId),
    [workspaces, currentWorkspaceId],
  );

  const value = useMemo<WorkspacesContextValue | undefined>(() => {
    if (!manager) {
      return undefined;
    }
    return {
      workspaces,
      currentWorkspace,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
      switchWorkspace,
      refresh,
    };
  }, [
    manager,
    workspaces,
    currentWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    switchWorkspace,
    refresh,
  ]);

  return <WorkspacesContext.Provider value={value}>{children}</WorkspacesContext.Provider>;
}
