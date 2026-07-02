/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import {
  useWorkspaces,
  WorkspacesContextValue,
} from "@lichtblick/suite-base/context/WorkspacesContext";
import { useConfirm } from "@lichtblick/suite-base/hooks/useConfirm";
import { usePrompt } from "@lichtblick/suite-base/hooks/usePrompt";
import { Workspace } from "@lichtblick/suite-base/services/workspaces/IWorkspacesManager";
import WorkspaceBuilder from "@lichtblick/suite-base/testing/builders/WorkspaceBuilder";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/WorkspacesContext", () => ({
  useWorkspaces: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => jest.fn());

jest.mock("@lichtblick/suite-base/hooks/usePrompt", () => ({
  usePrompt: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useConfirm", () => ({
  useConfirm: jest.fn(),
}));

describe("WorkspaceSwitcher", () => {
  const mockPrompt = jest.fn();
  const mockConfirm = jest.fn();

  function createContextValue(
    overrides: Partial<WorkspacesContextValue> = {},
  ): jest.Mocked<WorkspacesContextValue> {
    return {
      workspaces: [],
      currentWorkspace: undefined,
      createWorkspace: jest.fn(),
      renameWorkspace: jest.fn().mockResolvedValue(undefined),
      deleteWorkspace: jest.fn().mockResolvedValue(undefined),
      switchWorkspace: jest.fn().mockResolvedValue(undefined),
      refresh: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as jest.Mocked<WorkspacesContextValue>;
  }

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: (key: string) => key });
    (isDesktopApp as jest.Mock).mockReturnValue(true);
    (usePrompt as jest.Mock).mockReturnValue([mockPrompt, undefined]);
    (useConfirm as jest.Mock).mockReturnValue([mockConfirm, undefined]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render nothing when there is no workspaces context (web build)", () => {
    // GIVEN no workspaces provider
    (useWorkspaces as jest.Mock).mockReturnValue(undefined);

    // WHEN rendering the switcher
    const { container } = render(<WorkspaceSwitcher />);

    // THEN nothing is rendered
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("workspace-switcher-button")).not.toBeInTheDocument();
  });

  it("should render nothing when not running as a desktop app", () => {
    // GIVEN a workspaces context but a non-desktop build
    (useWorkspaces as jest.Mock).mockReturnValue(createContextValue());
    (isDesktopApp as jest.Mock).mockReturnValue(false);

    // WHEN rendering the switcher
    const { container } = render(<WorkspaceSwitcher />);

    // THEN nothing is rendered
    expect(container).toBeEmptyDOMElement();
  });

  it("should show the legacy label on the button when no workspace is active", () => {
    // GIVEN a desktop context with no current workspace
    (useWorkspaces as jest.Mock).mockReturnValue(
      createContextValue({ currentWorkspace: undefined }),
    );

    // WHEN rendering the switcher
    render(<WorkspaceSwitcher />);

    // THEN the button shows the legacy workspace label
    expect(screen.getByTestId("workspace-switcher-button")).toHaveTextContent("legacyWorkspace");
  });

  it("should show the current workspace name on the button when one is active", () => {
    // GIVEN a desktop context with a current workspace
    const current = WorkspaceBuilder.workspace({ name: "Robotics" });
    (useWorkspaces as jest.Mock).mockReturnValue(
      createContextValue({ workspaces: [current], currentWorkspace: current }),
    );

    // WHEN rendering the switcher
    render(<WorkspaceSwitcher />);

    // THEN the button shows the workspace name
    expect(screen.getByTestId("workspace-switcher-button")).toHaveTextContent("Robotics");
  });

  it("should list all workspaces plus the legacy item when the menu is opened", () => {
    // GIVEN a desktop context with several workspaces
    const workspaces = WorkspaceBuilder.workspaces();
    (useWorkspaces as jest.Mock).mockReturnValue(createContextValue({ workspaces }));

    render(<WorkspaceSwitcher />);

    // WHEN opening the menu
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // THEN the legacy item and one item per workspace are shown
    expect(screen.getByTestId("workspace-item-legacy")).toBeInTheDocument();
    expect(screen.getAllByTestId("workspace-item")).toHaveLength(workspaces.length);
    expect(screen.getByTestId("create-personal-workspace")).toBeInTheDocument();
  });

  it("should call switchWorkspace with the workspace id when a workspace item is clicked", () => {
    // GIVEN a desktop context with workspaces
    const workspaces = WorkspaceBuilder.workspaces();
    const context = createContextValue({ workspaces });
    (useWorkspaces as jest.Mock).mockReturnValue(context);

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // WHEN clicking the first workspace item
    fireEvent.click(screen.getAllByTestId("workspace-item")[0]!);

    // THEN switchWorkspace is called with that workspace's id
    expect(context.switchWorkspace).toHaveBeenCalledWith(workspaces[0]!.id);
  });

  it("should call switchWorkspace with undefined when the legacy item is clicked", () => {
    // GIVEN a desktop context with a current workspace
    const workspaces = WorkspaceBuilder.workspaces();
    const context = createContextValue({ workspaces, currentWorkspace: workspaces[0] });
    (useWorkspaces as jest.Mock).mockReturnValue(context);

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // WHEN clicking the legacy item
    fireEvent.click(screen.getByTestId("workspace-item-legacy"));

    // THEN switchWorkspace is called with undefined (fall back to legacy folders)
    expect(context.switchWorkspace).toHaveBeenCalledWith(undefined);
  });

  it("should create then switch to a workspace when the create item is used", async () => {
    // GIVEN a desktop context and a prompt that resolves a new name
    const created: Workspace = WorkspaceBuilder.workspace({ namespace: "local" });
    const context = createContextValue();
    context.createWorkspace.mockResolvedValue(created);
    (useWorkspaces as jest.Mock).mockReturnValue(context);
    mockPrompt.mockResolvedValue("Fresh Workspace");

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // WHEN clicking the create item
    fireEvent.click(screen.getByTestId("create-personal-workspace"));

    // THEN a local workspace is created and then selected
    await waitFor(() => {
      expect(context.createWorkspace).toHaveBeenCalledWith("Fresh Workspace", "local");
    });
    await waitFor(() => {
      expect(context.switchWorkspace).toHaveBeenCalledWith(created.id);
    });
  });

  it("should not create a workspace when the create prompt is cancelled", async () => {
    // GIVEN a prompt that resolves undefined (cancelled)
    const context = createContextValue();
    (useWorkspaces as jest.Mock).mockReturnValue(context);
    mockPrompt.mockResolvedValue(undefined);

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // WHEN clicking create but cancelling the prompt
    fireEvent.click(screen.getByTestId("create-personal-workspace"));

    // THEN no workspace is created
    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalled();
    });
    expect(context.createWorkspace).not.toHaveBeenCalled();
  });

  it("should hide the rename and delete items when no workspace is active", () => {
    // GIVEN a desktop context with no current workspace
    (useWorkspaces as jest.Mock).mockReturnValue(
      createContextValue({ currentWorkspace: undefined }),
    );

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // THEN the rename and delete items are not present
    expect(screen.queryByTestId("rename-workspace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delete-workspace")).not.toBeInTheDocument();
  });

  it("should show the rename and delete items when a workspace is active", () => {
    // GIVEN a desktop context with a current workspace
    const current = WorkspaceBuilder.workspace();
    (useWorkspaces as jest.Mock).mockReturnValue(
      createContextValue({ workspaces: [current], currentWorkspace: current }),
    );

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // THEN the rename and delete items are present
    expect(screen.getByTestId("rename-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("delete-workspace")).toBeInTheDocument();
  });

  it("should rename the current workspace when the rename item is confirmed", async () => {
    // GIVEN a current workspace and a prompt returning a new name
    const current = WorkspaceBuilder.workspace({ name: "Old Name" });
    const context = createContextValue({ workspaces: [current], currentWorkspace: current });
    (useWorkspaces as jest.Mock).mockReturnValue(context);
    mockPrompt.mockResolvedValue("New Name");

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // WHEN clicking rename and providing a new name
    fireEvent.click(screen.getByTestId("rename-workspace"));

    // THEN the workspace is renamed
    await waitFor(() => {
      expect(context.renameWorkspace).toHaveBeenCalledWith(current.id, "New Name");
    });
  });

  it("should delete the current workspace when the delete item is confirmed", async () => {
    // GIVEN a current workspace and a confirm dialog that resolves "ok"
    const current = WorkspaceBuilder.workspace();
    const context = createContextValue({ workspaces: [current], currentWorkspace: current });
    (useWorkspaces as jest.Mock).mockReturnValue(context);
    mockConfirm.mockResolvedValue("ok");

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // WHEN clicking delete and confirming
    fireEvent.click(screen.getByTestId("delete-workspace"));

    // THEN the workspace is deleted
    await waitFor(() => {
      expect(context.deleteWorkspace).toHaveBeenCalledWith(current.id);
    });
  });

  it("should not delete the current workspace when the confirmation is cancelled", async () => {
    // GIVEN a current workspace and a confirm dialog that resolves "cancel"
    const current = WorkspaceBuilder.workspace();
    const context = createContextValue({ workspaces: [current], currentWorkspace: current });
    (useWorkspaces as jest.Mock).mockReturnValue(context);
    mockConfirm.mockResolvedValue("cancel");

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher-button"));

    // WHEN clicking delete but cancelling the confirmation
    fireEvent.click(screen.getByTestId("delete-workspace"));

    // THEN no deletion happens
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    expect(context.deleteWorkspace).not.toHaveBeenCalled();
  });
});
