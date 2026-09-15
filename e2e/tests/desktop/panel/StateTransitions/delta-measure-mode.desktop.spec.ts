// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";
import { Panels } from "../../../../page-objects";

const MCAP_FILENAME = "example.mcap";

const openStateTransitionsPanel = async (
  mainWindow: Parameters<typeof loadFiles>[0]["mainWindow"],
): Promise<void> => {
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });
  await new Panels(mainWindow).addPanel("State Transitions");
};

/**
 * GIVEN a State Transitions panel is open
 * WHEN the user enables measure mode
 * THEN the delta overlay should be visible
 */
test("should show the delta overlay when measure mode is enabled", { tag: "@regression" }, async ({
  mainWindow,
}) => {
  // Given
  await openStateTransitionsPanel(mainWindow);
  const toggle = mainWindow.getByTestId("state-transitions-measure-mode-toggle");

  // When
  await toggle.click();

  // Then
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(mainWindow.getByTestId("delta-overlay")).toBeVisible();
});

/**
 * GIVEN a State Transitions panel is in measure mode
 * WHEN the user closes the delta overlay
 * THEN measure mode should be disabled and the overlay should disappear
 */
test("should close State Transitions measure mode from the overlay", {
  tag: "@regression",
}, async ({ mainWindow }) => {
  // Given
  await openStateTransitionsPanel(mainWindow);
  const toggle = mainWindow.getByTestId("state-transitions-measure-mode-toggle");
  await toggle.click();
  await expect(mainWindow.getByTestId("delta-overlay")).toBeVisible();

  // When
  await mainWindow.getByTestId("delta-overlay-close").click();

  // Then
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(mainWindow.getByTestId("delta-overlay")).toBeHidden();
});
