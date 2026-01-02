// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
 * GIVEN the app is started via CLI with --source flag pointing to two MCAPs
 * THEN the file names, example.mcap and example-2.mcap, should be visible on the main window
 * And the "Play" button enabled
 */
test("should open a file passed with flag --source via CLI", async ({ mainWindow }) => {
  // Then
  const sourceTitle = mainWindow.getByText(`${mcapOne}, ${mcapTwo}`);
  const playButton = mainWindow.getByRole("button", { name: "Play", exact: true });
  await expect(sourceTitle).toBeVisible();
  await expect(playButton).toBeEnabled();
});
