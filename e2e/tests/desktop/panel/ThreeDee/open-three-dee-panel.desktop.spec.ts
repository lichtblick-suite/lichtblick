// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";
import { Panels, Sidebar } from "../../../../page-objects";

const MCAP_FILE = "example-converter.mcap";
const EXTENSION_FILE = "lichtblickteam.message-converter-extension-0.0.2.foxe";

/**
 * GIVEN an .mcap file is loaded
 * AND the message converter is installed
 * WHEN the user adds the "3D" panel
 * AND the user clicks on the "3D" panel
 * THEN the topics should be visible on the settings tree
 */
test("open 3D panel after loading a mcap file", { tag: "@regression" }, async ({ mainWindow }) => {
  const panels = new Panels(mainWindow);
  const sidebar = new Sidebar(mainWindow);

  /// Given
  await loadFiles({
    mainWindow,
    filenames: MCAP_FILE,
  });

  await loadFiles({
    mainWindow,
    filenames: EXTENSION_FILE,
  });

  // When
  await panels.addPanel("3D");
  await sidebar.openPanelSettingsTab();
  await mainWindow.getByText("3D").nth(0).click();

  // Then
  await expect(mainWindow.getByTestId("VisibilityToggle")).toBeVisible();
});
