// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";

const extensionSourceFolder = "lichtblick.suite-extension-turtlesim-0.0.1";

/**
 * GIVEN turtlesim extension in already on root level folder
 * WHEN the extensions menu is opened
 * AND searched for turtlesim
 * THEN the turtlesim extension should appear on the extensions list
 */
test.use({
  preInstalledExtensions: [extensionSourceFolder],
});

test("should install an extension (user folder)", async ({ mainWindow }) => {
  // When
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  await mainWindow.getByTestId("user-button").click();
  await mainWindow.getByRole("menuitem", { name: "Extensions" }).click();
  const searchBar = mainWindow.getByPlaceholder("Search Extensions...");
  await searchBar.fill("turtlesim");
  const turtlesimExtension = mainWindow
    .locator('[data-testid="extension-list-entry"]')
    .filter({ hasText: "turtlesim" })
    .filter({ hasText: "0.0.1" });

  // Then
  await expect(turtlesimExtension).toBeVisible();
});
