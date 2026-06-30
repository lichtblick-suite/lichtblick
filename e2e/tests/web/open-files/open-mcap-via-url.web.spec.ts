// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "@playwright/test";

import { TEST_MCAP_URL } from "../../../fixtures/urls";
import { PlayerControls } from "../../../page-objects";

test("should open an MCAP file via URL", { tag: "@smoke" }, async ({ page }) => {
  const player = new PlayerControls(page);

  // Given
  await page.goto(`/?ds=remote-file&ds.url=${TEST_MCAP_URL}`);

  // When
  const sourceTitle = page.getByText(TEST_MCAP_URL.slice(0, 25));
  const playButton = page.getByRole("button", { name: "Play", exact: true });
  const pauseButton = page.getByRole("button", { name: "Pause", exact: true });

  // Then
  await expect(sourceTitle).toBeVisible();
  await expect(playButton).toBeEnabled();

  // When
  await player.getProgressPlot().waitFor({ state: "hidden" });
  await playButton.click();

  // Then
  await expect(playButton).not.toBeVisible();
  await expect(pauseButton).toBeEnabled();
});
