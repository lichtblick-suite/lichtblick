// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, WorkspaceSwitcher } from "../../../page-objects";

/**
 * Given a desktop app with a pre-seeded workspace marked as the current selection on disk
 * When the app starts
 * Then the workspace switcher shows the seeded workspace as active
 * And the seeded workspace is listed alongside the other workspaces
 */
test.use({
  preSeededWorkspaces: {
    workspaces: [
      { id: "ws-alpha", name: "Alpha", namespace: "local", current: true },
      { id: "ws-beta", name: "Beta", namespace: "org" },
    ],
  },
});

test(
  "loads the persisted current workspace on startup",
  { tag: "@smoke" },
  async ({ mainWindow }) => {
    const dialog = new DataSourceDialog(mainWindow);
    const switcher = new WorkspaceSwitcher(mainWindow);

    // GIVEN / WHEN
    await dialog.close();
    await expect(dialog.getLocator()).toBeHidden();

    // THEN
    await expect(switcher.button()).toContainText("Alpha");

    // WHEN
    await switcher.open();

    // THEN
    await expect(switcher.workspaceItem("Alpha")).toBeVisible();
    await expect(switcher.workspaceItem("Beta")).toBeVisible();
  },
);
