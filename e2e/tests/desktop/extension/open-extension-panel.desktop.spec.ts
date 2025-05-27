// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

test("open extension panel", async ({ mainWindow }) => {
  // Given
  const filename = "lichtblick.suite-extension-turtlesim-0.0.1.foxe";
  await loadFile({
    mainWindow,
    filename,
  });

  // When
  // Close startup dialog
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  // Click on Add Panel button
  await mainWindow.getByLabel("Add panel button").click();
  // And search for "Turtle"
  await mainWindow.getByText("Turtle [local]").click();

  // Then
  // There is a panel on screen named "Turtle"
  await expect(mainWindow.getByText("Turtle", { exact: true }).count()).resolves.toBe(1);
});
