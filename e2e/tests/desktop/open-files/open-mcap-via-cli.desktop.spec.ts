// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "path";

import { test, expect } from "../../../fixtures/electron";

const fileName = "example.mcap";
const filePath = path.resolve(process.cwd(), "e2e/fixtures/assets", fileName);

// Given
test.use({
  electronArgs: [`--source=${filePath}`],
});

/**
 * GIVEN the app is started via CLI with --source flag pointing to a MCAP
 * THEN the file name should be visible on the main window
 * And the "Play" button enabled
 */
test("should open a file passed with flag --source via CLI", async ({ mainWindow }) => {
  // Then
  const sourceTitle = mainWindow.getByText(fileName);
  const playButton = mainWindow.getByRole("button", { name: "Play", exact: true });
  await expect(sourceTitle).toBeVisible();
  await expect(playButton).toBeEnabled();
});
