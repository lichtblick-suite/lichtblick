// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Page } from "playwright";

import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";

const LAYOUT_FILE = "imported-layout.json";

async function splitPanel(mainWindow: Page, panelId: string): Promise<void> {
  await mainWindow
    .getByTestId(`panel-mouseenter-container ${panelId}`)
    .getByTestId("panel-menu")
    .click();
  await mainWindow.waitForTimeout(1000);
  await mainWindow.getByRole("menuitem", { name: "Split down" }).click();
  await mainWindow.waitForTimeout(1000);
}

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
  const importedLayout = mainWindow.getByRole("button", { name: "imported-layout" });
  await expect(importedLayout).toHaveCount(1);

  // When
  await splitPanel(mainWindow, "3D!18i6zy7");

  // Then
  const unsavedChangesIcon = mainWindow
    .getByRole("listitem")
    .filter({ hasText: "imported-layout" })
    .getByTestId("unsaved-changes-icon");
  await expect(unsavedChangesIcon).toBeVisible();

  // When
  await unsavedChangesIcon.click();
  await mainWindow.getByRole("menuitem", { name: "Revert" }).click();

  // Then
  await expect(unsavedChangesIcon).not.toBeVisible();
});

/**
 * GIVEN multiple layouts with unsaved changes
 * WHEN the user selects all layouts with unsaved changes and reverts them
 * THEN the unsaved changes icon should disappear from all layouts
 */
test("makes changes to multiple layouts and then reverts them", async ({ mainWindow }) => {
  // Given
  await loadFiles({ mainWindow, filenames: LAYOUT_FILE });
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();

  const importedLayout = mainWindow.getByRole("button", { name: "imported-layout" });
  await expect(importedLayout).toHaveCount(1);

  // When
  await splitPanel(mainWindow, "3D!18i6zy7");
  await mainWindow.getByRole("button", { name: "default" }).click();
  await splitPanel(mainWindow, "3D!18i6zy7");

  // Then
  const unsavedChangesIcons = mainWindow.getByRole("listitem").getByTestId("unsaved-changes-icon");
  await expect(unsavedChangesIcons).toHaveCount(2);

  // When
  await mainWindow
    .getByRole("listitem")
    .filter({ hasText: "imported-layout" })
    .getByTestId("layout-list-item")
    .click({ modifiers: ["Control"] });

  await mainWindow
    .getByRole("listitem")
    .filter({ hasText: "imported-layout" })
    .getByTestId("unsaved-changes-icon")
    .click();

  await mainWindow.getByRole("menuitem", { name: "Revert" }).click();
  const discardButton = mainWindow.getByRole("button", { name: "Discard changes" });
  await discardButton.waitFor({ state: "visible" });
  await discardButton.click();

  // Then
  await expect(unsavedChangesIcons).toHaveCount(0);
});
