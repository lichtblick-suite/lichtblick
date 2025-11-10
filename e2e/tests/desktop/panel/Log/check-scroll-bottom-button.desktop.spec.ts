// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../../fixtures/electron";
import { loadFile } from "../../../../fixtures/load-file";

const MCAP_FILENAME = "example_logs.mcap";

/**
 * GIVEN a .mcap file is loaded
 * WHEN the user adds the "Log" panel
 * AND the user clicks on the "Log" panel settings
 * THEN the "Log panel" settings should be visible
 */
// test("open log panel after loading an mcap file", async ({ mainWindow }) => {
//   /// Given
//   await loadFile({
//     mainWindow,
//     filename: MCAP_FILENAME,
//   });

//   // When
//   await mainWindow.getByTestId("AddPanelButton").click();
//   await mainWindow.getByRole("button", { name: "Log" }).click();
//   await mainWindow.getByTestId("log-panel-root").getByRole("button", { name: "Settings" }).click();

//   // Then
//   await expect(mainWindow.getByText("Log panel", { exact: true }).count()).resolves.toBe(1);
// });

/**
 * GIVEN a .mcap file is loaded
 * WHEN the user adds the "Log" panel
 * AND the user clicks on the "Log" panel settings
 * THEN the "Log panel" settings should be visible
 */
test('should not show "scroll to bottom" button when log panel is loaded', async ({
  mainWindow,
}) => {
  /// Given
  await loadFile({
    mainWindow,
    filename: MCAP_FILENAME,
  });

  // When
  await mainWindow.getByTestId("AddPanelButton").click();
  await mainWindow.getByRole("button", { name: "Log" }).click();

  await mainWindow.keyboard.press("Space"); // start playback

  // Then
  await expect(mainWindow.getByTestId("scroll-to-bottom-button").count()).resolves.toBe(0);
});
