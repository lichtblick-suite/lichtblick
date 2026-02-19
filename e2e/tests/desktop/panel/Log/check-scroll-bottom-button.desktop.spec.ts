// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { changeToEpochFormat } from "../../../../fixtures/change-to-epoch-format";
import { test, expect } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";

const MCAP_FILENAME = "example_logs.mcap";

/**
 * GIVEN a .mcap file is loaded
 * WHEN the user adds the "Log" panel
 * AND the user clicks on the "Log" panel settings
 * THEN the "Log panel" settings should be visible
 */
test("open log panel after loading an mcap file", async ({ mainWindow }) => {
  /// Given
  await loadFiles({
    mainWindow,
    filenames: MCAP_FILENAME,
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
test('should show "scroll to bottom" button when there is a scroll up in the log panel 2', async ({
  mainWindow,
}) => {
  // This test usually takes slightly longer than the default 30s timeout
  test.setTimeout(60_000);
  /// Given
  await loadFiles({
    mainWindow,
    filenames: MCAP_FILENAME,
  });

  // When
  await mainWindow.getByTestId("AddPanelButton").click();
  await mainWindow.getByRole("button", { name: "Log" }).click();

  const playButton = mainWindow.getByTestId("play-button");
  // Change to epoch time format to make calculations easier
  await changeToEpochFormat(mainWindow);
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");

  const initialValue: string = await timestamp.inputValue();
  const initialTimestamp: number = Number(initialValue);

  await expect(playButton).toHaveAttribute("title", "Play");
  await playButton.click();

  // Verify timestamp actually moves.
  await expect(async () => {
    const inputValue: string = await timestamp.inputValue();
    const currentTimestamp: number = Number(inputValue);

    expect(currentTimestamp).toBeGreaterThan(initialTimestamp);
  }).toPass({
    timeout: 5000,
    intervals: [100],
  });
  await expect(playButton).toHaveAttribute("title", "Pause", { timeout: 5_000 });

  const logPanel = mainWindow.getByTestId("log-panel-root");
  const scrollToBottomBtn = mainWindow.getByTestId("scroll-to-bottom-button");

  await logPanel.hover();
  // Scroll up until the button shows up. More resiliant than a single scroll which can be flaky.
  await expect(async () => {
    await mainWindow.mouse.wheel(0, -200);
    // Then
    await expect(scrollToBottomBtn).toBeVisible({ timeout: 1000 });
  }).toPass({
    intervals: [500],
    timeout: 10_000,
  });
});
