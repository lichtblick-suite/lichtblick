// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "@playwright/test";

import { loadFile } from "../../fixtures/load-file";

/**
 * GIVEN two Lichtblick web instances are running in different tabs
 * WHEN the same file is loaded in both instances
 * AND sync is turned on and play is clicked
 * THEN both instances should have the same timestamp
 */
test("Should sync playback between multiple web instances", async ({ browser }) => {
  // Create a browser context - this enables BroadcastChannel communication between tabs
  const context = await browser.newContext();

  // Create two pages (tabs) in the same context
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  try {
    // Navigate both pages to the Lichtblick web app
    await page1.goto("/");
    await page2.goto("localhost:8080");

    // Wait for both pages to load
    await page1.waitForLoadState("networkidle");
    await page2.waitForLoadState("networkidle");

    // Load the same file in both instances
    const filename = "example.mcap";

    // Load file in first tab
    await loadFile({ mainWindow: page1, filename });
    await page1.waitForSelector('input[value*="2025-02-26"]', { timeout: 15000 });

    // Load file in second tab
    await loadFile({ mainWindow: page2, filename });
    await page2.waitForSelector('input[value*="2025-02-26"]', { timeout: 15000 });

    // Verify sync button is available and initially off in both tabs
    await expect(page1.getByText("Sync")).toBeVisible();
    await expect(page2.getByText("Sync")).toBeVisible();
    await expect(page1.getByText("off")).toBeVisible();
    await expect(page2.getByText("off")).toBeVisible();

    // Enable sync in both instances by clicking the Sync button
    await page1.getByText("Sync").click();
    await page2.getByText("Sync").click();

    // Verify sync is enabled (button should show "on")
    await expect(page1.getByText("on")).toBeVisible();
    await expect(page2.getByText("on")).toBeVisible();

    // Get initial timestamps to ensure they're the same before playing
    const initialTimeInput1 = page1.locator('input[value*="2025-02-26"]').first();
    const initialTimeInput2 = page2.locator('input[value*="2025-02-26"]').first();

    const initialTime1 = await initialTimeInput1.inputValue();
    const initialTime2 = await initialTimeInput2.inputValue();

    // Both instances should start with the same timestamp
    expect(initialTime1).toBe(initialTime2);

    // Click play on the first instance
    await page1.getByTitle("Play", { exact: true }).click();
    await page1.waitForTimeout(100);

    // Verify both instances are playing (pause button visible)
    await expect(page1.getByTitle("Pause")).toBeVisible();
    await expect(page2.getByTitle("Pause")).toBeVisible();

    // Wait a bit for sync to propagate and playback to advance
    await page1.waitForTimeout(2000);

    // Pause to get stable timestamps
    await page1.getByTitle("Pause").click();
    await page1.waitForTimeout(100);

    // Verify both instances are paused (play button visible)
    await expect(page1.getByTitle("Play", { exact: true })).toBeVisible();
    await expect(page2.getByTitle("Play", { exact: true })).toBeVisible();

    // Get current time from both instances after playing
    const timeInput1 = page1.locator('input[value*="2025-02-26"]').first();
    const timeInput2 = page2.locator('input[value*="2025-02-26"]').first();

    const time1 = await timeInput1.inputValue();
    const time2 = await timeInput2.inputValue();

    // Both instances should have the same timestamp after sync
    expect(time1).toBe(time2);

    // The timestamp should have advanced from the initial time
    expect(time1).not.toBe(initialTime1);

    // Test seek synchronization
    // Seek forward on instance 1
    await page1.getByTitle("Seek forward").click();
    await page1.waitForTimeout(100);

    const newTime1 = await timeInput1.inputValue();
    const newTime2 = await timeInput2.inputValue();

    // Timestamps should have changed and still be synchronized
    expect(newTime1).not.toBe(time1);
    expect(newTime1).toBe(newTime2);
  } finally {
    // Clean up
    await page1.close();
    await page2.close();
    await context.close();
  }
});
