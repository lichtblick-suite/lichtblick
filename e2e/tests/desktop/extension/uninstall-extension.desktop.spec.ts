// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";

/**
 * GIVEN the "turtlesim" extension file is loaded
 * WHEN the user navigates to the extensions menu and selects "turtlesim"
 * THEN the uninstall option should be enabled
 * WHEN the user confirms the uninstall
 * THEN a toast indicating "Uninstalling..." should appear
 */
test("should uninstall an extension", async ({ mainWindow }) => {
  // Given
  const filename = "lichtblick.suite-extension-turtlesim-0.0.1.foxe";
  await loadFiles({
    mainWindow,
    filenames: filename,
  });
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  // When
  await mainWindow.getByTestId("PersonIcon").click();
  await mainWindow.getByRole("menuitem", { name: "Extensions" }).click();
  const searchBar = mainWindow.getByPlaceholder("Search Extensions...");
  await searchBar.fill("turtlesim");
  const extensionListItem = mainWindow
    .locator('[data-testid="extension-list-entry"]')
    .filter({ hasText: "turtlesim" })
    .filter({ hasText: "0.0.1" });
  await extensionListItem.click();
  const uninstallButton = mainWindow.getByText("Uninstall");

  // Then
  await expect(uninstallButton).toBeEnabled();

  // When
  await uninstallButton.click();
  const uninstallingToast = mainWindow.getByText("Uninstalling...");

  // Then
  await expect(uninstallingToast).toBeVisible();
});
