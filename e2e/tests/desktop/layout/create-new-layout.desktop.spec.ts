// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, LayoutManager, Sidebar } from "../../../page-objects";

/**
 * GIVEN the user is on the layouts tab
 * WHEN they create a new layout and add a panel (e.g., Diagnostics - Details)
 * THEN the new layout should appear with the name "Unnamed layout"
 */
test(
  "create a new layout by accessing Layouts > Create new layout",
  { tag: "@smoke" },
  async ({ mainWindow }) => {
    const dialog = new DataSourceDialog(mainWindow);
    const sidebar = new Sidebar(mainWindow);
    const layout = new LayoutManager(mainWindow);

    // Given
    await dialog.close();
    await sidebar.openLayoutsTab();

    // When
    await layout.openDefaultLayout();
    await layout.createNewLayout();
    await layout.selectPanel("Diagnostics – Detail (ROS)");

    // Then
    await expect(mainWindow.getByText("Unnamed layout").nth(0).innerText()).resolves.toContain(
      "Unnamed layout",
    );
  },
);
