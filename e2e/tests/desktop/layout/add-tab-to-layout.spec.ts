// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { loadFromFilePicker } from "../../../fixtures/load-from-file-picker";

const LAYOUT_FILE = "tab-layout.json";

/**
 * GIVEN the user is on the Layouts tab and a layout containing a tab is loaded
 * THEN one tab is already visible and ready to accept additional panels
 * WHEN a tab group is created inside the parent tab using a 3D panel
 * THEN the layout should display two tabs (parent and child)
 * WHEN a new tab is added from the child tab label
 * THEN the layout should display three tabs
 * WHEN the parent tab is removed
 * THEN the layout should display zero tabs
 */
test("create a new layout and add a tab", async ({ mainWindow }) => {
  test.setTimeout(45_000);
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();
  await loadFromFilePicker(mainWindow, LAYOUT_FILE);
  await mainWindow.getByRole("button", { name: "Import from file…" }).click();

  //Then
  await expect(mainWindow.getByTestId("toolbar-tab")).toHaveCount(1);

  // When
  const panelSearch = mainWindow.getByTestId("panel-list-textfield").locator("input");
  await panelSearch.fill("tab");
  await mainWindow.getByRole("button", { name: "Tab Group panels together" }).click();
  await mainWindow.getByRole("button", { name: "3d" }).click();

  // Then
  await expect(mainWindow.getByTestId("toolbar-tab")).toHaveCount(2);
  await expect(mainWindow.getByTestId("add-tab")).toHaveCount(2);

  // When
  await mainWindow.getByTestId("add-tab").nth(1).click();

  // Then
  await expect(mainWindow.getByTestId("toolbar-tab")).toHaveCount(3);

  // When
  await mainWindow.getByTestId("tab-icon").nth(0).click();

  // Then
  await expect(mainWindow.getByTestId("toolbar-tab")).toHaveCount(0);
});
