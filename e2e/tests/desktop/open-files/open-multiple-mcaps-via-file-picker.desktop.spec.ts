// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";

const MCAP_ONE = "example.mcap";
const MCAP_TWO = "example-2.mcap";

/**
 * GIVEN 2 .mcap files are loaded via file picker
 * THEN the filenames should be visible and the "Play" button enabled
 */
test("should open multiple MCAP files via file picker", async ({ mainWindow }) => {
  // Given
  const filenames = [MCAP_ONE, MCAP_TWO];
  await loadFiles({
    mainWindow,
    filenames,
  });
  // Then
  const filenamesText = filenames.join(", ");
  const sourceTitle = mainWindow.getByText(filenamesText);

  const playButton = mainWindow.getByRole("button", { name: "Play", exact: true });
  await expect(sourceTitle).toBeVisible();
  await expect(playButton).toBeEnabled();
});
