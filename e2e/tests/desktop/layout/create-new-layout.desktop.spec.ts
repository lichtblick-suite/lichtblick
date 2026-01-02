// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

/**
 * GIVEN the user is on the layouts tab
 * WHEN they create a new layout and add a panel (e.g., Diagnostics - Details)
 * THEN the new layout should appear with the name "Unnamed layout"
 */
test("create a new layout by accessing Layouts > Create new layout", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();

  // When
  await mainWindow.getByTestId("layout-list-item").getByText("Default", { exact: true }).click();
  await mainWindow.getByText("Create new layout").click();
  await mainWindow.getByTestId("panel-grid-card Diagnostics – Detail (ROS)").click();

  // Then
  await expect(mainWindow.getByText("Unnamed layout").nth(0).innerText()).resolves.toContain(
    "Unnamed layout",
  );
});
