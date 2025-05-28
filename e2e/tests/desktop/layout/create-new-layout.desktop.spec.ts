// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

test("create a new layout by accessing Layouts > Create new layout", async ({ mainWindow }) => {
  // Given
  // Close startup dialog
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  // Click on Layouts tab
  await mainWindow.getByTestId("layouts-left").click();

  // When
  // Click on Layouts tab
  await mainWindow.getByTestId("layout-list-item").getByText("Default", { exact: true }).click();
  // Click on Create new layout
  await mainWindow.getByText("Create new layout").click();
  // Click on Diagnostics - Details (ROS) panel
  await mainWindow.getByTestId("panel-grid-card Diagnostics – Detail (ROS)").click();

  // Then
  // A new layout is created under the name "Unnamed layout"
  await expect(
    mainWindow.getByText("Unnamed layout", { exact: false }).nth(0).innerText(),
  ).resolves.toContain("Unnamed layout");
});
