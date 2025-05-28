// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

/**
 * GIVEN the app is on the initial screen
 * WHEN the user opens the File > Open... menu
 * THEN the Data Source dialog should appear
 */
test("Display the data source dialog when clicking File > Open...", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  // When
  await mainWindow.getByTestId("AppMenuButton").click();
  await mainWindow.getByTestId("app-menu-file").click();
  await mainWindow.getByTestId("menu-item-open").click();

  // Then
  await expect(mainWindow.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(true);
});
