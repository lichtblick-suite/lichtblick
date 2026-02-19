// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";

/**
 * GIVEN a .mcap file is loaded
 * WHEN playback time displayed is hovered
 * And playback time dropown button is clicked
 * And playback time epoch format is selected
 * THEN the player time displayed should change to 1740566235.547000000 (epoch format)
 */
test("should switch playback time to epoch format next to the player", async ({ mainWindow }) => {
  // Given
  const initialTimeInUTC = "2025-02-26 10:37:15.547 AM WET";
  const intialTimeInEpoch = "1740566235.547000000";

  const filename = "example.mcap";
  await loadFiles({
    mainWindow,
    filenames: filename,
  });

  // When
  const playerStartingTime = mainWindow.locator(`input[value="${initialTimeInUTC}"]`);
  // Playback time display needs to be hovered first so clicking on it is possible
  await playerStartingTime.hover();

  const timestampDropdown = mainWindow.getByTestId("playback-time-display-toggle-button");
  await timestampDropdown.click();

  const newTimestampOption = mainWindow.getByTestId("playback-time-display-option-SEC");
  await newTimestampOption.click();

  // Then
  const playerStartingTimeInEpoch = mainWindow.locator(`input[value="${intialTimeInEpoch}"]`);
  await expect(playerStartingTimeInEpoch).toBeVisible();
});
