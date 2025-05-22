// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

test("should open an MCAP file via file picker", async ({ mainWindow }) => {
  // Given
  const filename = "example.mcap";
  await loadFile({
    mainWindow,
    filename,
  });

  // When
  const sourceTitle = mainWindow.getByText(filename);
  const playButton = mainWindow.getByRole("button", { name: "Play", exact: true });

  // Then
  await expect(sourceTitle).toBeVisible();
  await expect(playButton).toBeEnabled();
});
