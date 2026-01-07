// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../../fixtures/electron";
import { loadFile } from "../../../../fixtures/load-file";

/**
 * GIVEN an .mcap file is loaded
 * AND the message converter is installed
 * WHEN the user adds the "3D" panel
 * AND the user clicks on the "3D" panel
 * THEN the topics should be visible on the settings tree
 */
test("open 3D panel after loading a mcap file", async ({ mainWindow }) => {
  /// Given
  const mcapFile = "example-converter.mcap";
  await loadFile({
    mainWindow,
    filename: mcapFile,
  });

  const extensionFile = "lichtblickteamctw.message-converter-extension-0.0.2.foxe";
  await loadFile({
    mainWindow,
    filename: extensionFile,
  });

  // When
  await mainWindow.getByTestId("AddPanelButton").click();
  await mainWindow.getByTestId("panel-menu-item 3D").click();
  await mainWindow.getByTestId("panel-settings-left").click();
  await mainWindow.getByText("3D").nth(0).click();

  // Then
  await expect(mainWindow.getByTestId("VisibilityToggle")).toBeVisible();
});
