// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, LayoutManager, Sidebar } from "../../../page-objects";

/**
 * GIVEN the layouts sidebar is open with the Default layout
 * WHEN the user clicks the favorite toggle on the Default layout
 * THEN the toggle should be marked as pressed and stay visible without hovering
 */
test("mark a layout as favorite via the star toggle", { tag: "@smoke" }, async ({ mainWindow }) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);

  // Given
  await dialog.close();
  await sidebar.openLayoutsTab();

  // When
  await layout.toggleFavorite("Default");

  // Then
  const favoriteToggle = layout.getFavoriteToggle("Default");
  await expect(favoriteToggle).toHaveAttribute("aria-pressed", "true");
  await expect(favoriteToggle).toHaveAttribute("aria-label", "Remove from favorites");
  await expect(favoriteToggle).toBeVisible();
});

/**
 * GIVEN a layout has been marked as favorite
 * WHEN the user clicks the favorite toggle again
 * THEN the toggle should no longer be pressed
 */
test("unmark a layout as favorite via the star toggle", { tag: "@regression" }, async ({
  mainWindow,
}) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);

  // Given
  await dialog.close();
  await sidebar.openLayoutsTab();
  await layout.toggleFavorite("Default");
  const favoriteToggle = layout.getFavoriteToggle("Default");
  await expect(favoriteToggle).toHaveAttribute("aria-pressed", "true");

  // When
  await favoriteToggle.click();

  // Then
  await expect(favoriteToggle).toHaveAttribute("aria-pressed", "false");
  await expect(favoriteToggle).toHaveAttribute("aria-label", "Add to favorites");
});

/**
 * GIVEN two personal layouts, "Default" and "Z layout", listed alphabetically with "Z layout" last
 * WHEN "Z layout" is marked as favorite
 * THEN it should be listed above "Default", which is not a favorite
 */
test("list favorited layouts above non-favorited layouts", { tag: "@regression" }, async ({
  mainWindow,
}) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);

  // Given
  await dialog.close();
  await sidebar.openLayoutsTab();
  await layout.openDefaultLayout();
  await layout.createNewLayout();
  await layout.renameLayout("Unnamed layout", "Z layout");
  await expect(layout.getLayoutListItem()).toHaveText(["Default", "Z layout"]);

  // When
  await layout.toggleFavorite("Z layout");

  // Then
  await expect(layout.getLayoutListItem()).toHaveText(["Z layout", "Default"]);
});
