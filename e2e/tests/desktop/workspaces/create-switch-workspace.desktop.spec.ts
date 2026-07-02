// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, WorkspaceSwitcher } from "../../../page-objects";

/**
 * Given a fresh desktop app with no workspaces on disk (backward-compat)
 * Then the workspace switcher shows the default (no-workspace) label
 *
 * When the user creates a new workspace "My Workspace"
 * Then the switcher shows "My Workspace" as the active workspace
 *
 * When the user switches back to the default (no workspace)
 * Then the switcher shows the default label again
 */
test("create and switch workspace", { tag: "@smoke" }, async ({ mainWindow }) => {
  const dialog = new DataSourceDialog(mainWindow);
  const switcher = new WorkspaceSwitcher(mainWindow);

  // GIVEN
  await dialog.close();
  await expect(dialog.getLocator()).toBeHidden();
  await expect(switcher.button()).toContainText("Default (no workspace)");

  // WHEN
  await switcher.create("My Workspace");

  // THEN
  await expect(switcher.button()).toContainText("My Workspace");

  // Switching workspaces remounts the app subtree, reopening the start dialog.
  await dialog.closeIfVisible();

  // WHEN
  await switcher.switchToLegacy();

  // THEN
  await expect(switcher.button()).toContainText("Default (no workspace)");
});
