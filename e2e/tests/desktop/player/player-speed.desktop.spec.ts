// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { changeToEpochFormat } from "../../../fixtures/change-to-epoch-format";
import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";
import { PlayerControls } from "../../../page-objects";

const MCAP_FILENAME = "example.mcap";

/**
 * GIVEN a .mcap file is loaded
 * WHEN playback speed is set to 2x
 * THEN it should play roughly twice as fast
 */

test(
  "should double playback speed after choosing 2x",
  { tag: "@regression" },
  async ({ mainWindow }) => {
    const player = new PlayerControls(mainWindow);

    // Given
    await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
    await changeToEpochFormat(mainWindow);

    const expectedRatio = 2;
    const expectedDuration = 500; // ms

    await player.setSpeed("1×"); // make sure we're on 1x speed

    const measureProgress = async (durationMs: number): Promise<number> => {
      const start = await player.getTimestampValue();
      await player.togglePlayback(); // start playback
      await mainWindow.waitForTimeout(durationMs);
      await player.togglePlayback(); // stop playback
      const end = await player.getTimestampValue();
      return end - start;
    };

    // When
    const normalProgress = await measureProgress(expectedDuration);

    await player.setSpeed("2×"); // change to 2x speed

    // Then
    const newProgress = await measureProgress(expectedDuration);

    // Assert new playback speed
    const ratio = newProgress / normalProgress;
    const tolerance = expectedRatio * 0.2;

    expect(ratio).toBeGreaterThan(expectedRatio - tolerance);
    expect(ratio).toBeLessThan(expectedRatio + tolerance);
  },
);

/**
 * GIVEN a .mcap file is loaded
 * WHEN playback speed is set to 0.1x
 * THEN it should play roughly one-tenth as fast
 */

test(
  "should playback at one-tenth speed after choosing 0.1x",
  { tag: "@regression" },
  async ({ mainWindow }) => {
    const player = new PlayerControls(mainWindow);

    // Given
    await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
    await changeToEpochFormat(mainWindow);

    const expectedRatio = 0.1;
    const expectedDuration = 500; // ms

    await player.setSpeed("1×"); // make sure we're on 1x speed

    const measureProgress = async (durationMs: number): Promise<number> => {
      const start = await player.getTimestampValue();
      await player.togglePlayback(); // start playback
      await mainWindow.waitForTimeout(durationMs);
      await player.togglePlayback(); // stop playback
      const end = await player.getTimestampValue();
      return end - start;
    };

    // When
    const normalProgress = await measureProgress(expectedDuration);

    await player.setSpeed("0.1×"); // change to 0.1x speed

    // Then
    const newProgress = await measureProgress(expectedDuration);

    // Assert new playback speed
    const ratio = newProgress / normalProgress;
    const tolerance = expectedRatio * 0.2;

    expect(ratio).toBeGreaterThan(expectedRatio - tolerance);
    expect(ratio).toBeLessThan(expectedRatio + tolerance);
  },
);
