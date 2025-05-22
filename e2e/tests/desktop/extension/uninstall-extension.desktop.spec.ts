// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

test("should uninstall an extension", async ({ mainWindow }) => {
  // Given
  const filename = "lichtblick.suite-extension-turtlesim-0.0.1.foxe";
  await loadFile({
    mainWindow,
    filename,
  });

  // When
  // Close startup dialog
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  // Open user menu
  await mainWindow.getByTestId("PersonIcon").click();
  // Open extensions menu
  await mainWindow.getByRole("menuitem", { name: "Extensions" }).click();
  // Fill search bar and find by installed extension
  const searchBar = mainWindow.getByPlaceholder("Search Extensions...");
  await searchBar.fill("turtlesim");
  // Open extension in the list
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
