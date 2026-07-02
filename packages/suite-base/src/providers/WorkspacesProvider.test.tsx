/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook, waitFor } from "@testing-library/react";

import { useWorkspaces } from "@lichtblick/suite-base/context/WorkspacesContext";
import WorkspacesProvider from "@lichtblick/suite-base/providers/WorkspacesProvider";
import {
  IWorkspacesManager,
  Workspace,
} from "@lichtblick/suite-base/services/workspaces/IWorkspacesManager";
import WorkspaceBuilder from "@lichtblick/suite-base/testing/builders/WorkspaceBuilder";

type RenderOptions = {
  manager?: IWorkspacesManager;
  currentWorkspaceId?: string;
  onSwitchWorkspace?: () => void;
};

function createManagerMock(workspaces: Workspace[]): jest.Mocked<IWorkspacesManager> {
  return {
    list: jest.fn().mockResolvedValue(workspaces),
    create: jest.fn(),
    rename: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    getCurrent: jest.fn().mockResolvedValue(undefined),
    setCurrent: jest.fn().mockResolvedValue(undefined),
  };
}

function renderWorkspacesHook({ manager, currentWorkspaceId, onSwitchWorkspace }: RenderOptions) {
  return renderHook(() => useWorkspaces(), {
    wrapper: ({ children }) => (
      <WorkspacesProvider
        manager={manager}
        currentWorkspaceId={currentWorkspaceId}
        onSwitchWorkspace={onSwitchWorkspace}
      >
        {children}
      </WorkspacesProvider>
    ),
  });
}

describe("WorkspacesProvider", () => {
  it("should expose no context value when no manager is provided", () => {
    // GIVEN a provider without a manager (e.g. the web build)
    // WHEN reading the workspaces context
    const { result } = renderWorkspacesHook({ manager: undefined });

    // THEN the hook returns undefined so workspace UI stays hidden
    expect(result.current).toBeUndefined();
  });

  it("should populate the workspaces list from the manager on mount", async () => {
    // GIVEN a manager with a list of workspaces
    const workspaces = WorkspaceBuilder.workspaces();
    const manager = createManagerMock(workspaces);

    // WHEN mounting the provider
    const { result } = renderWorkspacesHook({ manager });

    // THEN the context exposes the listed workspaces
    await waitFor(() => {
      expect(result.current?.workspaces).toEqual(workspaces);
    });
    expect(manager.list).toHaveBeenCalledTimes(1);
  });

  it("should derive the current workspace from the list and current id", async () => {
    // GIVEN a manager and a selected current workspace id
    const workspaces = WorkspaceBuilder.workspaces();
    const current = workspaces[1]!;
    const manager = createManagerMock(workspaces);

    // WHEN mounting with the current workspace id
    const { result } = renderWorkspacesHook({ manager, currentWorkspaceId: current.id });

    // THEN currentWorkspace resolves to the matching entry
    await waitFor(() => {
      expect(result.current?.currentWorkspace).toEqual(current);
    });
  });

  it("should create a workspace, refresh the list, and return the created workspace", async () => {
    // GIVEN a manager that creates a new workspace
    const workspaces = WorkspaceBuilder.workspaces();
    const created = WorkspaceBuilder.workspace();
    const manager = createManagerMock(workspaces);
    manager.create.mockResolvedValue(created);

    const { result } = renderWorkspacesHook({ manager });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // WHEN creating a workspace
    let returned: Workspace | undefined;
    await act(async () => {
      returned = await result.current!.createWorkspace("New WS", "org");
    });

    // THEN the manager creates it, the list is refreshed, and the created workspace is returned
    expect(manager.create).toHaveBeenCalledWith("New WS", "org");
    expect(manager.list).toHaveBeenCalledTimes(2);
    expect(returned).toEqual(created);
  });

  it("should rename a workspace and refresh the list", async () => {
    // GIVEN a manager
    const workspaces = WorkspaceBuilder.workspaces();
    const manager = createManagerMock(workspaces);

    const { result } = renderWorkspacesHook({ manager });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // WHEN renaming a workspace
    await act(async () => {
      await result.current!.renameWorkspace(workspaces[0]!.id, "Renamed");
    });

    // THEN the manager renames it and the list is refreshed
    expect(manager.rename).toHaveBeenCalledWith(workspaces[0]!.id, "Renamed");
    expect(manager.list).toHaveBeenCalledTimes(2);
  });

  it("should delete a workspace, refresh, and fall back to legacy when deleting the current workspace", async () => {
    // GIVEN a manager with a current workspace and an onSwitchWorkspace callback
    const workspaces = WorkspaceBuilder.workspaces();
    const current = workspaces[0]!;
    const manager = createManagerMock(workspaces);
    const onSwitchWorkspace = jest.fn();

    const { result } = renderWorkspacesHook({
      manager,
      currentWorkspaceId: current.id,
      onSwitchWorkspace,
    });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // WHEN deleting the current workspace
    await act(async () => {
      await result.current!.deleteWorkspace(current.id);
    });

    // THEN the manager deletes and refreshes, and the host is signalled to fall back to legacy
    expect(manager.delete).toHaveBeenCalledWith(current.id);
    expect(manager.list).toHaveBeenCalledTimes(2);
    expect(onSwitchWorkspace).toHaveBeenCalledTimes(1);
  });

  it("should not switch workspace when deleting a workspace that is not current", async () => {
    // GIVEN a current workspace and a different workspace being deleted
    const workspaces = WorkspaceBuilder.workspaces();
    const current = workspaces[0]!;
    const other = workspaces[1]!;
    const manager = createManagerMock(workspaces);
    const onSwitchWorkspace = jest.fn();

    const { result } = renderWorkspacesHook({
      manager,
      currentWorkspaceId: current.id,
      onSwitchWorkspace,
    });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // WHEN deleting the other (non-current) workspace
    await act(async () => {
      await result.current!.deleteWorkspace(other.id);
    });

    // THEN the deletion happens but the active selection is unchanged
    expect(manager.delete).toHaveBeenCalledWith(other.id);
    expect(onSwitchWorkspace).not.toHaveBeenCalled();
  });

  describe("switchWorkspace", () => {
    it("should be a no-op when switching to the already-current workspace", async () => {
      // GIVEN a current workspace
      const workspaces = WorkspaceBuilder.workspaces();
      const current = workspaces[0]!;
      const manager = createManagerMock(workspaces);
      const onSwitchWorkspace = jest.fn();

      const { result } = renderWorkspacesHook({
        manager,
        currentWorkspaceId: current.id,
        onSwitchWorkspace,
      });
      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // WHEN switching to the already-current workspace
      await act(async () => {
        await result.current!.switchWorkspace(current.id);
      });

      // THEN nothing is persisted and no remount is requested
      expect(manager.setCurrent).not.toHaveBeenCalled();
      expect(onSwitchWorkspace).not.toHaveBeenCalled();
    });

    it("should persist the selection and signal the host when switching to a new one", async () => {
      // GIVEN a current workspace and a different target
      const workspaces = WorkspaceBuilder.workspaces();
      const current = workspaces[0]!;
      const target = workspaces[1]!;
      const manager = createManagerMock(workspaces);
      const onSwitchWorkspace = jest.fn();

      const { result } = renderWorkspacesHook({
        manager,
        currentWorkspaceId: current.id,
        onSwitchWorkspace,
      });
      await waitFor(() => {
        expect(result.current?.workspaces).toEqual(workspaces);
      });

      // WHEN switching to the target workspace
      await act(async () => {
        await result.current!.switchWorkspace(target.id);
      });

      // THEN the selection is persisted and the host is signalled to remount
      expect(manager.setCurrent).toHaveBeenCalledWith(target.id);
      expect(onSwitchWorkspace).toHaveBeenCalledTimes(1);
    });

    it("should persist the cleared selection and signal the host when switching to legacy", async () => {
      // GIVEN a current workspace
      const workspaces = WorkspaceBuilder.workspaces();
      const current = workspaces[0]!;
      const manager = createManagerMock(workspaces);
      const onSwitchWorkspace = jest.fn();

      const { result } = renderWorkspacesHook({
        manager,
        currentWorkspaceId: current.id,
        onSwitchWorkspace,
      });
      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // WHEN switching to the legacy (undefined) workspace
      await act(async () => {
        await result.current!.switchWorkspace(undefined);
      });

      // THEN the selection is cleared and the host is signalled to fall back to legacy folders
      expect(manager.setCurrent).toHaveBeenCalledWith(undefined);
      expect(onSwitchWorkspace).toHaveBeenCalledTimes(1);
    });
  });
});
