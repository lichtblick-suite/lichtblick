// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { changeToEpochFormat } from "../../../fixtures/change-to-epoch-format";
import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";
import { PlayerControls } from "../../../page-objects";

const MCAP_FILENAME = "example.mcap";

/**
 * GIVEN a .mcap file is loaded
 * And Play button is shown
 * WHEN play button is clicked
 * THEN the play icon should change
 * And playback time should advance
 */

test("should start playing when clicking on Play button", { tag: "@smoke" }, async ({
  mainWindow,
}) => {
  const player = new PlayerControls(mainWindow);

  // Given
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  const startTime = await player.getTimestampValue();

  // When
  await expect(player.getPlayButton()).toHaveAttribute("title", "Play");
  await player.play();

  // Then
  await expect(player.getPlayButton()).toHaveAttribute("title", "Pause");
  const elapsedTimestamp = await player.getTimestampValue();
  expect(elapsedTimestamp).toBeGreaterThan(startTime);
});

/**
 * GIVEN a .mcap file is loaded
 * WHEN spacebar key is pressed
 * THEN the play icon should change
 * And playback time should advance
 */

test("should start playing when clicking on Spacebar key", { tag: "@smoke" }, async ({
  mainWindow,
}) => {
  const player = new PlayerControls(mainWindow);

  // Given
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);
  const startTime = await player.getTimestampValue();

  // When
  await expect(player.getPlayButton()).toHaveAttribute("title", "Play");
  await player.togglePlayback();

  // Then
  await expect(player.getPlayButton()).toHaveAttribute("title", "Pause");
  const elapsedTimestamp = await player.getTimestampValue();
  expect(elapsedTimestamp).toBeGreaterThan(startTime);
});

/**
 * GIVEN a .mcap file is loaded
 * And player is playing
 * WHEN pause button is pressed
 * THEN the pause icon should change
 * And playback time should stop
 */

test("should stop playing when clicking on Play button", { tag: "@smoke" }, async ({
  mainWindow,
}) => {
  const player = new PlayerControls(mainWindow);

  // Given
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  await player.play();

  // When
  await expect(player.getPlayButton()).toHaveAttribute("title", "Pause");
  await player.pause();

  // Then
  await expect(player.getPlayButton()).toHaveAttribute("title", "Play");
  const startTime = await player.getTimestampValue();

  await mainWindow.waitForTimeout(1000);
  const elapsedTimestamp = await player.getTimestampValue();
  expect(elapsedTimestamp).toEqual(startTime);
});

/**
 * GIVEN a .mcap file is loaded
 * And player is playing
 * WHEN Spacebar key is pressed
 * THEN the pause icon should change
 * And playback time should stop
 */

test("should stop playing when clicking on Spacebar key", { tag: "@smoke" }, async ({
  mainWindow,
}) => {
  const player = new PlayerControls(mainWindow);

  // Given
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
  await changeToEpochFormat(mainWindow);

  await player.togglePlayback();

  // When
  await expect(player.getPlayButton()).toHaveAttribute("title", "Pause");
  await player.togglePlayback();

  // Then
  await expect(player.getPlayButton()).toHaveAttribute("title", "Play");
  const startTime = await player.getTimestampValue();

  await mainWindow.waitForTimeout(1000);
  const elapsedTimestamp = await player.getTimestampValue();
  expect(elapsedTimestamp).toEqual(startTime);
});
