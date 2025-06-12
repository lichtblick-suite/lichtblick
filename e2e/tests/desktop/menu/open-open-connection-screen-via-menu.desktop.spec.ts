// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

/**
 * GIVEN the app is on the initial screen
 * WHEN the user opens the File Open... > Open connection menu
 * AND the user clicks on the "Open connection" button
 * THEN the "Open a new connection" dialog should appear
 */
test("Display the open a new connection dialog when clicking File > Open... > Open connection", async ({
  mainWindow,
}) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  // When
  await mainWindow.getByTestId("AppMenuButton").click();
  await mainWindow.getByTestId("app-menu-file").click();
  await mainWindow.getByTestId("menu-item-open").click();
  await mainWindow.getByText("Open connection").nth(0).click();

  // Then
  await expect(mainWindow.getByText("Open a new connection", { exact: true })).toBeVisible();
});
