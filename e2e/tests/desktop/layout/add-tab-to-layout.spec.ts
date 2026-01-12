// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { loadFromFilePicker } from "../../../fixtures/load-from-file-picker";

const LAYOUT_FILE = "tab-layout.json";

/**
 * GIVEN the user is on the layouts tab
 * WHEN they create a new layout and add a tab
 * THEN the new layout should appear with a tab and ready to add more panels
 * WHEN adding a tab inside the tab parent with a 3d panel
 * THEN the layout is expected to have two tabs visible (parent and child)
 * WHEN is added a new tab at child label
 * THEN there should be three tabs in the layout
 * WHEN the parent tab is remove
 * THEN the layout should have zero tabs
 */
test("create a new layout and add a tab", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();
  await loadFromFilePicker(mainWindow, LAYOUT_FILE);
  await mainWindow.getByRole("button", { name: "Import from file…" }).click();

  await expect(
    mainWindow.getByTestId("layout-list-item").getByText("tab-layout", { exact: true }),
  ).toBeVisible();
  await expect(mainWindow.getByTestId("toolbar-tab")).toHaveCount(1);

  // When
  // await mainWindow.getByTestId("layout-list-item").getByText("Default", { exact: true }).click();
  // const createLayoutButton = mainWindow.getByText("Create new layout");
  // await expect(createLayoutButton).toBeVisible();
  // await expect(createLayoutButton).toBeEnabled();
  // await createLayoutButton.click();

  const panelSearch = mainWindow.getByTestId("panel-list-textfield").locator("input");
  await panelSearch.fill("tab");

  await mainWindow.getByRole("button", { name: "Tab Group panels together" }).click();

  // Then
  await expect(mainWindow.getByTestId("panel-list-textfield")).toBeVisible();

  // When
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
