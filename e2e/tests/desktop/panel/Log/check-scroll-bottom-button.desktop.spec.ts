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
test.skip("open log panel after loading an mcap file", async ({ mainWindow }) => {
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
  // file is loaded
  await expect(mainWindow.getByTestId("data-source-name")).toHaveText(MCAP_FILENAME);
  await expect(mainWindow.getByTestId("loading-file-spinner")).toBeHidden();

  // Add Log Panel
  await mainWindow.getByTestId("AddPanelButton").click();
  await mainWindow.getByRole("button", { name: "Log" }).click();
  await expect(mainWindow.getByTestId("log-panel-root")).toBeVisible();

  const playButton = mainWindow.getByTestId("play-button");

  // Change to epoch time format to make calculations easier
  await changeToEpochFormat(mainWindow);
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");

  const initialTimestamp = Number(await timestamp.inputValue());

  // console.log("initial", initialTimestamp);
  // await mainWindow.waitForTimeout(2000); // wait for UI to settle

  // Start playback and wait until timestamp advances (button can be flaky if pressed too quickly)
  let currentTimestamp = initialTimestamp;
  while (currentTimestamp <= initialTimestamp) {
    await expect(playButton).toHaveAttribute("title", "Play");

    // console.log("clicking play");
    await playButton.click();
    await expect(playButton).toHaveAttribute("title", "Pause");
    // Wait 50ms before checking again
    await mainWindow.waitForTimeout(20);

    // Get the current timestamp
    currentTimestamp = Number(await timestamp.inputValue());
  }
  await mainWindow.waitForTimeout(400); // wait for some logs to accumulate
  await expect(playButton).toHaveAttribute("title", "Pause");

  // console.log("it's playing", Number(await timestamp.inputValue()));
  await expect(mainWindow.getByTestId("scroll-to-bottom-button")).toBeHidden();

  await mainWindow.keyboard.press("Space"); // stop playback
  await expect(playButton).toHaveAttribute("title", "Play");

  // console.log("it's stopped", Number(await timestamp.inputValue()));
  // await mainWindow.screenshot({ path: "before-scrolling-up.png" });

  // console.log("is it actually stopped?", Number(await timestamp.inputValue()));
  // Find the log panel area and scroll up
  const logPanel = mainWindow.getByTestId("log-panel-root");
  await logPanel.hover();
  await mainWindow.mouse.wheel(0, -1500); // scroll up

  // await mainWindow.screenshot({ path: "after-scrolling-up.png" });
  await mainWindow.waitForTimeout(300); // wait for some logs to accumulate

  // Then
  await expect(mainWindow.getByTestId("scroll-to-bottom-button")).toBeVisible({ timeout: 5000 });
});
