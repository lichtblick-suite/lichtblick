// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";
import { PlayerControls } from "../../../page-objects";

/**
 * GIVEN a .mcap file is loaded
 * WHEN playback time displayed is hovered
 * And playback time dropown button is clicked
 * And playback time epoch format is selected
 * THEN the player time displayed should change to 1740566235.547000000 (epoch format)
 */
test(
  "should switch playback time to epoch format next to the player",
  { tag: "@regression" },
  async ({ mainWindow }) => {
    const player = new PlayerControls(mainWindow);

    // Given
    const initialTimeInUTC = "2025-02-26 10:37:15.547 AM WET";
    const intialTimeInEpoch = "1740566235.547000000";

    const filename = "example.mcap";
    await loadFiles({
      mainWindow,
      filenames: filename,
    });

    // When
    await player.switchToEpochFormat(initialTimeInUTC);

    // Then
    const playerStartingTimeInEpoch = mainWindow.locator(`input[value="${intialTimeInEpoch}"]`);
    await expect(playerStartingTimeInEpoch).toBeVisible();
  },
);
