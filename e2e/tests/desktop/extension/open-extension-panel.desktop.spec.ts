// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";

/**
 * GIVEN the "turtlesim" extension file is loaded
 * WHEN the user adds the "Turtle" panel
 * THEN the "Turtle" panel should be visible on the screen
 */
test("open extension panel", async ({ mainWindow }) => {
  // Given
  const filename = "lichtblick.suite-extension-turtlesim-0.0.1.foxe";
  await loadFiles({
    mainWindow,
    filenames: filename,
  });

  // When
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByLabel("Add panel button").click();
  await mainWindow.getByText("Turtle [local]").click();

  // Then
  await expect(mainWindow.getByText("Turtle", { exact: true }).count()).resolves.toBe(1);
});
