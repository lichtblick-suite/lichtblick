// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, LayoutManager, Sidebar } from "../../../page-objects";

/**
 * GIVEN the default layout is open
 * WHEN the user clicks on the 3D panel
 * THEN the 3D panel settings should be displayed
 */
test("open 3D panel when clicking on Layouts > layout", { tag: "@smoke" }, async ({
  mainWindow,
}) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);

  // Given
  await dialog.close();
  await sidebar.openLayoutsTab();
  await layout.openDefaultLayout();

  // When
  await sidebar.openPanelSettingsTab();
  await mainWindow.getByText("3D").nth(0).click();

  // Then
  await expect(mainWindow.getByText("3D panel", { exact: true }).count()).resolves.toBe(1);
});
