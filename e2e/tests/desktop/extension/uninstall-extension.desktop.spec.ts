// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";
import { DataSourceDialog, ExtensionManager } from "../../../page-objects";

/**
 * GIVEN the "turtlesim" extension file is loaded
 * WHEN the user navigates to the extensions menu and selects "turtlesim"
 * THEN the uninstall option should be enabled
 * WHEN the user confirms the uninstall
 * THEN a toast indicating "Uninstalling..." should appear
 */
test("should uninstall an extension", { tag: "@regression" }, async ({ mainWindow }) => {
  const dialog = new DataSourceDialog(mainWindow);
  const extensions = new ExtensionManager(mainWindow);

  // Given
  const filename = "lichtblick.suite-extension-turtlesim-0.0.1.foxe";
  await loadFiles({
    mainWindow,
    filenames: filename,
  });
  await dialog.close();

  // When
  await extensions.open();
  await extensions.search("turtlesim");
  await extensions.selectExtension("turtlesim", "0.0.1");
  const uninstallButton = mainWindow.getByText("Uninstall");

  // Then
  await expect(uninstallButton).toBeEnabled();

  // When
  await uninstallButton.click();
  const uninstallingToast = mainWindow.getByText("Uninstalling...");

  // Then
  await expect(uninstallingToast).toBeVisible();
});
