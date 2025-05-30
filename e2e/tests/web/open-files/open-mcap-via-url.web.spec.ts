// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "@playwright/test";

import { TEST_MCAP_URL } from "../../../fixtures/urls";

test("should open an MCAP file via URL", async ({ page }) => {
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
  await page.getByTestId("progress-plot").waitFor({ state: "hidden" });
  await playButton.click();

  // Then
  await expect(playButton).not.toBeVisible();
  await expect(pauseButton).toBeEnabled();
});
