// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

/**
 * GIVEN a .bag file is loaded via drag and drop
 * THEN the filename should be visible and the "Play" button enabled
 */
test("should open a BAG file via drag and drop", async ({ mainWindow }) => {
  // Given
  const filename = "example.bag";
  await loadFile({
    mainWindow,
    filename,
  });

  // Then
  const sourceTitle = mainWindow.getByText(filename);
  const playButton = mainWindow.getByRole("button", { name: "Play", exact: true });
  await expect(sourceTitle).toBeVisible();
  await expect(playButton).toBeEnabled();
});
