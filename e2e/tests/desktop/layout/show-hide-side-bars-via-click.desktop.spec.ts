// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, Sidebar } from "../../../page-objects";

/**
 * Given the Data Source dialog is closed
 * When the user presses clicks on the "Hide left sidebar button"
 * Then the left‐sidebar tabs are all hidden
 * When the user clicks on the "Show left sidebar" button
 * Then the left‐sidebar tabs are all visible
 */
test("show/hide left side bar via click", { tag: "@regression" }, async ({ mainWindow }) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);

  // Given
  await dialog.close();

  // When
  await sidebar.toggleLeftSidebar();

  // Then
  await expect(sidebar.getPanelSettingsTab()).not.toBeVisible();
  await expect(sidebar.getTopicsTab()).not.toBeVisible();
  await expect(sidebar.getAlertsTab()).not.toBeVisible();
  await expect(sidebar.getLayoutsTab()).not.toBeVisible();

  // When
  await sidebar.toggleLeftSidebar();

  // Then
  await expect(sidebar.getPanelSettingsTab()).toBeVisible();
  await expect(sidebar.getTopicsTab()).toBeVisible();
  await expect(sidebar.getAlertsTab()).toBeVisible();
  await expect(sidebar.getLayoutsTab()).toBeVisible();
});

/**
 * Given the Data Source dialog is closed
 * When the user presses clicks on the "Show right sidebar button"
 * Then the right‐sidebar tabs are all hidden
 * When the user clicks on the "Hide right sidebar" button
 * Then the right‐sidebar tabs are all visible
 */
test("hide/show right side bar via click", { tag: "@regression" }, async ({ mainWindow }) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);

  // Given
  await dialog.close();

  // When
  await sidebar.toggleRightSidebar();

  // Then
  await expect(sidebar.getVariablesTab()).toBeVisible();

  // When
  await sidebar.toggleRightSidebar();

  // Then
  await expect(sidebar.getVariablesTab()).not.toBeVisible();
});
