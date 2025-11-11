// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { changeToEpochFormat } from "../../../../fixtures/change-to-epoch-format";
import { test, expect } from "../../../../fixtures/electron";
import { loadFile } from "../../../../fixtures/load-file";

const MCAP_FILENAME = "example_logs.mcap";

/**
 * GIVEN a .mcap file is loaded
 * WHEN the user adds the "Log" panel
 * AND the user clicks on the "Log" panel settings
 * THEN the "Log panel" settings should be visible
 */
test("open log panel after loading an mcap file", async ({ mainWindow }) => {
  /// Given
  await loadFile({
    mainWindow,
    filename: MCAP_FILENAME,
  });

  // When
  await mainWindow.getByTestId("AddPanelButton").click();
  await mainWindow.getByRole("button", { name: "Log" }).click();
  await mainWindow.getByTestId("log-panel-root").getByRole("button", { name: "Settings" }).click();

  // Then
  await expect(mainWindow.getByText("Log panel", { exact: true }).count()).resolves.toBe(1);
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN the user adds the "Log" panel
 * AND the user clicks on play
 * AND the user scrolls up in the log panel
 * THEN the "scroll to bottom" button should be visible
 */
test('should show "scroll to bottom" button when there is a scroll up in the log panel', async ({
  mainWindow,
}) => {
  /// Given
  await loadFile({
    mainWindow,
    filename: MCAP_FILENAME,
  });

  // When
  // Add Log Panel
  await mainWindow.getByTestId("AddPanelButton").click();
  await mainWindow.getByRole("button", { name: "Log" }).click();

  const playButton = mainWindow.getByTestId("play-button");

  // Change to epoch time format to make calculations easier
  await changeToEpochFormat(mainWindow);
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");

  const initialTimestamp = Number(await timestamp.inputValue());

  // Start playback and wait until timestamp advances (button can be flaky if pressed too quickly)
  let currentTimestamp = initialTimestamp;
  while (currentTimestamp <= initialTimestamp) {
    await expect(playButton).toHaveAttribute("title", "Play");
    await playButton.click();

    // Wait 50ms before checking again
    await mainWindow.waitForTimeout(20);

    // Get the current timestamp
    currentTimestamp = Number(await timestamp.inputValue());
  }
  await mainWindow.waitForTimeout(100); // wait for some logs to accumulate

  // Find the log panel area and scroll up
  const logPanel = mainWindow.getByTestId("log-panel-root");
  await logPanel.hover();
  await mainWindow.mouse.wheel(0, -500); // negative Y = scroll up

  // Then
  await expect(mainWindow.getByTestId("scroll-to-bottom-button")).toBeVisible();
});
