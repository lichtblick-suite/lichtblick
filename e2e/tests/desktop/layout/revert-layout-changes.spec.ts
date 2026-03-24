// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";

const LAYOUT_FILE = "default-layout.json";

/**
 * GIVEN the default layout is open
 * WHEN the user makes changes to the layout and then reverts them
 * THEN the unsaved changes icon should be visible after making changes
 * AND should disappear after reverting them
 */
test("makes changes to layout and then reverts them", async ({ mainWindow }) => {
  // Given
  await loadFiles({
    mainWindow,
    filenames: LAYOUT_FILE,
  });

  // When
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();

  // Then
  const defaultLayout = mainWindow.getByRole("button", { name: "default-layout" });
  await expect(defaultLayout).toHaveCount(1);

  // When
  await mainWindow
    .getByTestId("panel-mouseenter-container 3D!18i6zy7")
    .getByTestId("panel-menu")
    .click();
  await mainWindow.waitForTimeout(500);
  await mainWindow.getByRole("menuitem", { name: "Split down" }).click();
  await mainWindow.waitForTimeout(500);

  // Then
  const unssavedChangesIcon = mainWindow
    .getByRole("listitem")
    .filter({ hasText: "default-layout" })
    .getByTestId("unsaved-changes-icon");
  await expect(unssavedChangesIcon).toBeVisible();

  // When
  await unssavedChangesIcon.click();
  await mainWindow.getByRole("menuitem", { name: "Revert" }).click();

  // Then
  await expect(unssavedChangesIcon).not.toBeVisible();
});
