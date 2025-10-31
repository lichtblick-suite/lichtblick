// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { changeToEpochFormat } from "../../../fixtures/change-to-epoch-format";
import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

const MCAP_FILENAME = "example.mcap";

/**
 * GIVEN a .mcap file is loaded
 * WHEN playback speed is set to 2x
 * THEN it should play roughly twice as fast
 */

test("should double playback speed after choosing 2x", async ({ mainWindow }) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  const expectedRatio = 2;
  const expectedDuration = 500; // ms
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  const dropDownButton = mainWindow.getByTestId("PlaybackSpeedControls-Dropdown");

  await dropDownButton.click();
  const regularSpeed = mainWindow.getByRole("menuitem", { name: "1×", exact: true }); // make sure we're on 1x speed
  await regularSpeed.click();
  await expect(regularSpeed).toHaveCount(0);

  const getTimestamp = async () => Number(await timestamp.inputValue());
  const measureProgress = async (durationMs: number): Promise<number> => {
    const start = await getTimestamp();
    await mainWindow.keyboard.press("Space"); // start playback
    await mainWindow.waitForTimeout(durationMs);
    await mainWindow.keyboard.press("Space"); // stop playback
    const end = await getTimestamp();
    return end - start;
  };

  // When
  const normalProgress = await measureProgress(expectedDuration);

  await dropDownButton.click();
  const speedOption = mainWindow.getByRole("menuitem", { name: "2×", exact: true }); // change to 2x speed
  await speedOption.click();
  await expect(speedOption).toHaveCount(0);

  // Then
  const newProgress = await measureProgress(expectedDuration);

  // Assert new playback speed
  const ratio = newProgress / normalProgress;
  const tolerance = expectedRatio * 0.2;

  expect(ratio).toBeGreaterThan(expectedRatio - tolerance);
  expect(ratio).toBeLessThan(expectedRatio + tolerance);
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN playback speed is set to 0.1x
 * THEN it should play roughly one-tenth as fast
 */

test("should playback at one-tenth speed after choosing 0.1x", async ({ mainWindow }) => {
  // Given
  await loadFile({ mainWindow, filename: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  const expectedRatio = 0.1;
  const expectedDuration = 500; // ms
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");
  const dropDownButton = mainWindow.getByTestId("PlaybackSpeedControls-Dropdown");

  await dropDownButton.click();
  const regularSpeed = mainWindow.getByRole("menuitem", { name: "1×", exact: true }); // make sure we're on 1x speed
  await regularSpeed.click();
  await expect(regularSpeed).toHaveCount(0);

  const getTimestamp = async () => Number(await timestamp.inputValue());
  const measureProgress = async (durationMs: number): Promise<number> => {
    const start = await getTimestamp();
    await mainWindow.keyboard.press("Space"); // start playback
    await mainWindow.waitForTimeout(durationMs);
    await mainWindow.keyboard.press("Space"); // stop playback
    const end = await getTimestamp();
    return end - start;
  };

  // When
  const normalProgress = await measureProgress(expectedDuration);

  await dropDownButton.click();
  const speedOption = mainWindow.getByRole("menuitem", { name: "0.1×", exact: true }); // change to 0.1x speed
  await speedOption.click();
  await expect(speedOption).toHaveCount(0);

  // Then
  const newProgress = await measureProgress(expectedDuration);

  // Assert new playback speed
  const ratio = newProgress / normalProgress;
  const tolerance = expectedRatio * 0.2;

  expect(ratio).toBeGreaterThan(expectedRatio - tolerance);
  expect(ratio).toBeLessThan(expectedRatio + tolerance);
});
