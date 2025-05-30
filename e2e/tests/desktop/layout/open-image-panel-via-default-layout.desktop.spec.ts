// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

/**
 * GIVEN the default layout is open
 * WHEN the user clicks on the Images panel
 * THEN the Images panel settings should be displayed
 */
test("open Image panel when clicking on Layouts > layout", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();
  await mainWindow.getByTestId("layout-list-item").getByText("Default", { exact: true }).click();

  // When
  await mainWindow.getByTestId("panel-settings-left").click();
  await mainWindow.getByText("Image").nth(0).click();

  // Then
  // The State Transitions panel settings are shown
  await expect(mainWindow.getByText("Image panel", { exact: true }).count()).resolves.toBe(1);
});
