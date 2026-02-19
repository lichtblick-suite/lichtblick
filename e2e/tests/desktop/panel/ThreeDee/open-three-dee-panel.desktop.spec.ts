// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";

const MCAP_FILE = "example-converter.mcap";
const EXTENSION_FILE = "lichtblickteamctw.message-converter-extension-0.0.2.foxe";

/**
 * GIVEN an .mcap file is loaded
 * AND the message converter is installed
 * WHEN the user adds the "3D" panel
 * AND the user clicks on the "3D" panel
 * THEN the topics should be visible on the settings tree
 */
test("open 3D panel after loading a mcap file", async ({ mainWindow }) => {
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
  await mainWindow.getByTestId("AddPanelButton").click();
  await mainWindow.getByTestId("panel-menu-item 3D").click();
  await mainWindow.getByTestId("panel-settings-left").click();
  await mainWindow.getByText("3D").nth(0).click();

  // Then
  await expect(mainWindow.getByTestId("VisibilityToggle")).toBeVisible();
});
