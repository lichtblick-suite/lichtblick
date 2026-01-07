// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";

/**
 * GIVEN the user is on the layouts tab
 * WHEN they create a new layout and add a panel (e.g., Diagnostics - Details)
 * THEN the new layout should appear with the name "Unnamed layout"
 */
test("create a new layout and add a tab", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();

  // When
  await mainWindow.getByTestId("layout-list-item").getByText("Default", { exact: true }).click();
  await mainWindow.getByText("Create new layout").click();

  const panelSearch = mainWindow.getByTestId("panel-list-textfield").locator("input");
  await panelSearch.fill("tab");

  await mainWindow.getByRole("button", { name: "Tab Group panels together" }).click();

  // Then
  await expect(mainWindow.getByTestId("toolbar-tab").count()).resolves.toBe(1);
});
