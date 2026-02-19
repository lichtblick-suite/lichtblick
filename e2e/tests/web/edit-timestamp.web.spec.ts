// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "@playwright/test";

import { loadFiles } from "../../fixtures/load-files";

const MCAP_FILENAME = "example.mcap";

/**
 * GIVEN a .mcap file and layout are loaded
 * AND the player time is initialized
 * WHEN the playback timestamp is manually edited in the player input
 * AND the new timestamp is confirmed
 * THEN the URL time parameter should update to the new ISO timestamp
 */

test("is able to manually edit the timestamp display on the player", async ({ page }) => {
  // Given
  const getTimeParam = () => new URL(page.url()).searchParams.get("time");

  await page.goto("/");
  await loadFiles({ mainWindow: page, filenames: MCAP_FILENAME });
  const urlInitialTimestamp = "2025-02-26T10:37:15.547000000Z";

  // When
  await page.evaluate((time) => {
    const url = new URL(window.location.href);
    url.searchParams.set("time", time);
    window.history.replaceState({}, "", url.toString());
  }, urlInitialTimestamp);
  await page.waitForURL(() => getTimeParam() === urlInitialTimestamp);

  // Then
  expect(getTimeParam()).toBe(urlInitialTimestamp);

  // When
  const timestampInput = page.getByTestId("PlaybackTime-text").locator("input");
  const newTimestamp = "2025-02-26 10:37:18.499 AM WET";
  await timestampInput.click();
  await timestampInput.fill(newTimestamp);
  await timestampInput.press("Enter");
  await timestampInput.blur();

  // Then
  const urlNewTimestamp = "2025-02-26T10:37:18.499000000Z";
  await page.waitForURL(() => getTimeParam() === urlNewTimestamp);
  expect(getTimeParam()).toBe(urlNewTimestamp);
});

/**
 * GIVEN a .mcap file and layout are loaded
 * AND the playback time display is switched to epoch format
 * AND the player time is initialized
 * WHEN the playback timestamp is manually edited using an epoch value
 * AND the new timestamp is confirmed
 * THEN the URL time parameter should update to the corresponding ISO timestamp
 */

test("is able to manually edit the timestamp display (epoch format) on the player", async ({
  page,
}) => {
  // Given
  const getTimeParam = () => new URL(page.url()).searchParams.get("time");

  await page.goto("/");
  await loadFiles({ mainWindow: page, filenames: MCAP_FILENAME });
  const urlInitialTimestamp = "2025-02-26T10:37:15.547000000Z";

  // When
  const playerStartingTime = page.getByTestId("PlaybackTime-text").locator("div");
  // Playback time display needs to be hovered first so clicking on it is possible
  await playerStartingTime.hover();
  await page.getByTestId("playback-time-display-toggle-button").click();
  await page.getByTestId("playback-time-display-option-SEC").click();

  // When
  await page.evaluate((time) => {
    const url = new URL(window.location.href);
    url.searchParams.set("time", time);
    window.history.replaceState({}, "", url.toString());
  }, urlInitialTimestamp);
  await page.waitForURL(() => getTimeParam() === urlInitialTimestamp);

  // Then
  expect(getTimeParam()).toBe(urlInitialTimestamp);

  // When
  const timestampInput = page.getByTestId("PlaybackTime-text").locator("input");
  const newEpochTimestamp = "1740566238.499000000";
  await timestampInput.click();
  await timestampInput.fill(newEpochTimestamp);
  await timestampInput.press("Enter");
  await timestampInput.blur();

  // Then
  const urlNewTimestamp = "2025-02-26T10:37:18.499000000Z";
  await page.waitForURL(() => getTimeParam() === urlNewTimestamp);
  expect(getTimeParam()).toBe(urlNewTimestamp);
});
