// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Locator, Page } from "playwright";
import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

const filename = "example.mcap";
function getPlaybackElements(mainWindow: Page) {
  const button = mainWindow.getByTestId("play-button");
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");

  return { button, timestamp };
}

async function changeToEpochFormat(mainWindow: Page) {
  const initialTimeInUTC = "2025-02-26 10:37:15.547 AM WET";

  // get date values in epoch format
  const playerStartingTime = mainWindow.locator(`input[value="${initialTimeInUTC}"]`);
  await playerStartingTime.hover();
  const timestampDropdown = mainWindow.getByTestId("playback-time-display-toggle-button");
  await timestampDropdown.click();

  const newTimestampOption = mainWindow.getByTestId("playback-time-display-option-SEC");
  await newTimestampOption.click();
}

async function expectPlayButtonState(button: Locator, isPlaying: boolean) {
  await expect(button).toHaveAttribute("title", isPlaying ? "Pause" : "Play");
}

/**
 * GIVEN a .mcap file is loaded
 * And Play button is shown
 * WHEN play button is clicked
 * THEN the play icon should change
 * And playback time should advance
 */

test("should start playing when clicking on Play button", async ({ mainWindow }) => {
  // Given
  await loadFile({ mainWindow, filename });
  await changeToEpochFormat(mainWindow);

  const { button, timestamp } = getPlaybackElements(mainWindow);
  const startTime = Number(await timestamp.inputValue());

  // When
  await expectPlayButtonState(button, false);
  button.click(); // start playback

  // Then
  await expectPlayButtonState(button, true);
  const elapsedTimestamp = Number(await timestamp.inputValue());
  expect(elapsedTimestamp).toBeGreaterThan(startTime);
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN spacebar key is pressed
 * THEN the play icon should change
 * And playback time should advance
 */

test("should start playing when clicking on Spacebar key", async ({ mainWindow }) => {
  // Given
  await loadFile({ mainWindow, filename });
  await changeToEpochFormat(mainWindow);
  const { button, timestamp } = getPlaybackElements(mainWindow);
  const startTime = Number(await timestamp.inputValue());

  // When
  await expectPlayButtonState(button, false);
  await mainWindow.keyboard.press("Space"); // start playback

  // Then
  await expectPlayButtonState(button, true);
  const elapsedTimestamp = Number(await timestamp.inputValue());
  expect(elapsedTimestamp).toBeGreaterThan(startTime);
});

/**
 * GIVEN a .mcap file is loaded
 * And player is playing
 * WHEN pause button is pressed
 * THEN the pause icon should change
 * And playback time should stop
 */

test("should stop playing when clicking on Play button", async ({ mainWindow }) => {
  // Given
  await loadFile({ mainWindow, filename });
  await changeToEpochFormat(mainWindow);
  const { button, timestamp } = getPlaybackElements(mainWindow);

  await button.click(); // start playback

  // When
  await expectPlayButtonState(button, true);
  await button.click(); // stop playback
  const startTime = Number(await timestamp.inputValue());

  // Then
  await expectPlayButtonState(button, false);
  await mainWindow.waitForTimeout(1000); // wait to check if value is still the same
  const elapsedTimestamp = Number(await timestamp.inputValue());
  expect(elapsedTimestamp).toEqual(startTime);
});

/**
 * GIVEN a .mcap file is loaded
 * And player is playing
 * WHEN Spacebar key is pressed
 * THEN the pause icon should change
 * And playback time should stop
 */

test("should stop playing when clicking on Spacebar key", async ({ mainWindow }) => {
  // Given
  await loadFile({ mainWindow, filename });
  await changeToEpochFormat(mainWindow);
  const { button, timestamp } = getPlaybackElements(mainWindow);

  await mainWindow.keyboard.press("Space"); // start playback

  // When
  await expectPlayButtonState(button, true);
  await mainWindow.keyboard.press("Space"); // stop playback
  const startTime = Number(await timestamp.inputValue());

  // Then
  await expectPlayButtonState(button, false);
  await mainWindow.waitForTimeout(1000); // wait to check if value is still the same
  const elapsedTimestamp = Number(await timestamp.inputValue());
  expect(elapsedTimestamp).toEqual(startTime);
});
