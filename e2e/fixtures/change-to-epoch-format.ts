// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Page } from "playwright";

import { expect } from "./electron";

export async function changeToEpochFormat(mainWindow: Page): Promise<void> {
  const initialTimeInUTC = "2025-02-26 10:37:15.547 AM WET";

  // get date values in epoch format
  const playerStartingTime = mainWindow.locator(`input[value="${initialTimeInUTC}"]`);
  await playerStartingTime.hover();
  const timestampDropdown = mainWindow.getByTestId("playback-time-display-toggle-button");
  await timestampDropdown.click();

  const newTimestampOption = mainWindow.getByTestId("playback-time-display-option-SEC");
  await newTimestampOption.click();
  await expect(newTimestampOption).toHaveCount(0); // wait until menu closes
}
