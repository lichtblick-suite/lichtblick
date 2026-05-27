// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";
import { Panels, Sidebar } from "../../../../page-objects";

/**
 * GIVEN a .bag file is loaded
 * WHEN the user adds the "Map" panel
 * AND the user clicks on the "Map" panel
 * THEN the "Map panel" settings should be visible
 */
test("open map panel after loading a bag file", { tag: "@regression" }, async ({ mainWindow }) => {
  const panels = new Panels(mainWindow);
  const sidebar = new Sidebar(mainWindow);

  /// Given
  const filename = "example.bag";
  await loadFiles({
    mainWindow,
    filenames: filename,
  });

  // When
  await panels.addPanel("Map");
  await sidebar.openPanelSettingsTab();
  await mainWindow.getByText("Waiting for first GPS point...").nth(0).click();

  // Then
  await expect(mainWindow.getByText("Map panel", { exact: true }).count()).resolves.toBe(1);
});
