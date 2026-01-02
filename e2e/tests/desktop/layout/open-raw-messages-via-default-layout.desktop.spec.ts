// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

/**
 * GIVEN the default layout is open
 * WHEN the user clicks on the Raw Messages panel
 * THEN the Raw Messages panel settings should be displayed
 */
test("open Raw Messages panel when clicking on Layouts > layout", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();
  await mainWindow.getByTestId("layout-list-item").getByText("Default", { exact: true }).click();

  // When
  await mainWindow.getByTestId("panel-settings-left").click();
  await mainWindow.getByText("No topic selected").nth(0).click();

  // Then
  await expect(mainWindow.getByText("Raw Messages panel", { exact: true }).count()).resolves.toBe(
    1,
  );
});
