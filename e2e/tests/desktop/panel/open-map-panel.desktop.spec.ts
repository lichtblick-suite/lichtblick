// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

test("open map panel after loading a bag file", async ({ mainWindow }) => {
  /// Given
  // A bag file is loaded
  const filename = "example.bag";
  await loadFile({
    mainWindow,
    filename,
  });

  // When
  // Click on Add Panel button
  await mainWindow.getByTestId("AddPanelButton").click();
  // And search for "Map" and click on "Map"
  await mainWindow.getByTestId("panel-menu-item Map").click();
  // And Click on Panels tab
  await mainWindow.getByTestId("panel-settings-left").click();
  // And Click on Map Panel
  await mainWindow.getByText("Waiting for first GPS point...").nth(0).click();

  // Then
  // There is a panel on screen named "Map panel"
  await expect(mainWindow.getByText("Map panel", { exact: true }).count()).resolves.toBe(1);
});
