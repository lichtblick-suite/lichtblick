// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, LayoutManager, Sidebar } from "../../../page-objects";

/**
 * GIVEN the user is on the layouts tab
 * WHEN they click the favorite star toggle on a layout
 * THEN the layout should be marked as favorite
 * AND clicking the toggle again should unmark it
 */
test(
  "should mark and unmark a layout as favorite when the star toggle is clicked",
  { tag: "@smoke" },
  async ({ mainWindow }) => {
    const dialog = new DataSourceDialog(mainWindow);
    const sidebar = new Sidebar(mainWindow);
    const layout = new LayoutManager(mainWindow);

    // Given
    await dialog.close();
    await sidebar.openLayoutsTab();
    const favoriteToggle = layout.getLayoutRow("Default").getByTestId("toggle-favorite-layout");

    // When
    await layout.toggleFavorite("Default");

    // Then
    await expect(favoriteToggle).toHaveAttribute("aria-pressed", "true");

    // When
    await layout.toggleFavorite("Default");

    // Then
    await expect(favoriteToggle).toHaveAttribute("aria-pressed", "false");
  },
);

/**
 * GIVEN two layouts, "Alpha" and "Zeta"
 * WHEN "Zeta" is marked as favorite
 * THEN "Zeta" should be listed before "Alpha"
 */
test(
  "should show the favorite layout first in the list",
  { tag: "@regression" },
  async ({ mainWindow }) => {
    const dialog = new DataSourceDialog(mainWindow);
    const sidebar = new Sidebar(mainWindow);
    const layout = new LayoutManager(mainWindow);

    // Given
    await dialog.close();
    await sidebar.openLayoutsTab();
    await layout.renameLayout("Default", "Alpha");
    await layout.createNewLayout();
    await layout.renameLayout("Unnamed layout", "Zeta");

    // When
    await layout.toggleFavorite("Zeta");

    // Then
    const orderedNames = await layout.getLayoutListItem().allTextContents();
    expect(orderedNames[0]).toContain("Zeta");
    expect(orderedNames[1]).toContain("Alpha");
  },
);

/**
 * GIVEN "Alpha" and "Zeta" layouts exist, "Alpha" is the currently open layout,
 * and "Zeta" is marked as favorite
 * WHEN the app is reloaded
 * THEN "Zeta" should automatically become the open layout instead of "Alpha"
 */
test(
  "should auto-open the favorite layout after reloading the app",
  { tag: "@regression" },
  async ({ mainWindow }) => {
    const dialog = new DataSourceDialog(mainWindow);
    const sidebar = new Sidebar(mainWindow);
    const layout = new LayoutManager(mainWindow);

    // Given
    await dialog.close();
    await sidebar.openLayoutsTab();
    await layout.renameLayout("Default", "Alpha");
    await layout.createNewLayout();
    await layout.renameLayout("Unnamed layout", "Zeta");
    await layout.selectLayout("Alpha");
    await layout.toggleFavorite("Zeta");

    // When
    await mainWindow.reload();
    await dialog.close();
    await sidebar.openLayoutsTab();

    // Then
    await expect(layout.getLayoutRow("Zeta").getByTestId("layout-list-item")).toHaveAttribute(
      "aria-current",
      "true",
    );
  },
);
