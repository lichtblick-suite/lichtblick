// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "path";

import { test, expect } from "../../../fixtures/electron";

const mcapOne = "example.mcap";
const pathToMcapOne = path.resolve(process.cwd(), "e2e/fixtures/assets", mcapOne);

const mcapTwo = "example-2.mcap";
const pathToMcapTwo = path.resolve(process.cwd(), "e2e/fixtures/assets", mcapTwo);

// Given
test.use({
  electronArgs: [`--source=${pathToMcapOne},${pathToMcapTwo}`],
});

/**
 * GIVEN --source flag with paths to two files is passed via CLI
 * THEN both the file names should be visible and the "Play" button enabled
 */
test("should open a file passed with flag --source via CLI", async ({ mainWindow }) => {
  // Then
  const sourceTitle = mainWindow.getByText(`${mcapOne}, ${mcapTwo}`);
  const playButton = mainWindow.getByRole("button", { name: "Play", exact: true });
  await expect(sourceTitle).toBeVisible();
  await expect(playButton).toBeEnabled();
});
