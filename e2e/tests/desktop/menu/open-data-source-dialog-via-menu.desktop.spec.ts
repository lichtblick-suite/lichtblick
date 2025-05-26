// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

test("Display the data source dialog when clicking File > Open...", async ({ mainWindow }) => {
  // Given
  // Close startup dialog
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();

  // When
  // Click on App menu button
  await mainWindow.getByTestId("AppMenuButton").click();
  // Click on "File" menu item
  await mainWindow.getByTestId("app-menu-file").click();
  // Click on "Open..." menu item
  await mainWindow.getByTestId("menu-item-open").click();

  // Then
  // Data Source dialog is opened
  await expect(mainWindow.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(true);
});
