// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Locator, Page } from "playwright";

import { changeToEpochFormat } from "../../../fixtures/change-to-epoch-format";
import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";

const MCAP_FILENAME = "example.mcap";

function getPlaybackElements(mainWindow: Page): { button: Locator; timestamp: Locator } {
  const button = mainWindow.getByTestId("play-button");
  const timestamp = mainWindow.getByTestId("PlaybackTime-text").locator("input");

  return { button, timestamp };
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
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  const { button, timestamp } = getPlaybackElements(mainWindow);
  const startTime = Number(await timestamp.inputValue());

  // When
  await expect(button).toHaveAttribute("title", "Play");
  await button.click(); // start playback

  // Then
  await expect(button).toHaveAttribute("title", "Pause");
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
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);
  const { button, timestamp } = getPlaybackElements(mainWindow);
  const startTime = Number(await timestamp.inputValue());

  // When
  await expect(button).toHaveAttribute("title", "Play");
  await mainWindow.keyboard.press("Space"); // start playback

  // Then
  await expect(button).toHaveAttribute("title", "Pause");
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
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);
  const { button, timestamp } = getPlaybackElements(mainWindow);

  await button.click(); // start playback

  // When
  await expect(button).toHaveAttribute("title", "Pause");
  await button.click(); // stop playback

  // Then
  await expect(button).toHaveAttribute("title", "Play"); // check if icon has changed first
  const startTime = Number(await timestamp.inputValue());

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
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);
  const { button, timestamp } = getPlaybackElements(mainWindow);

  await mainWindow.keyboard.press("Space"); // start playback

  // When
  await expect(button).toHaveAttribute("title", "Pause");
  await mainWindow.keyboard.press("Space"); // stop playback

  // Then
  await expect(button).toHaveAttribute("title", "Play"); // check if icon has changed first
  const startTime = Number(await timestamp.inputValue());

  await mainWindow.waitForTimeout(1000); // wait to check if value is still the same
  const elapsedTimestamp = Number(await timestamp.inputValue());
  expect(elapsedTimestamp).toEqual(startTime);
});
