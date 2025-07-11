// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

/**
 * Given the Data Source dialog is closed
 * When the user presses [ on their keyboard
 * Then the left‐sidebar tabs are all hidden
 * When the user presses [ again
 * Then the left‐sidebar tabs are all visible
 */
test("show/hide left side bar via shortcut", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  // When
  await mainWindow.keyboard.press("[");

  // Then
  await expect(mainWindow.getByTestId("panel-settings-left")).not.toBeVisible();
  await expect(mainWindow.getByTestId("topics-left")).not.toBeVisible();
  await expect(mainWindow.getByTestId("alerts-left")).not.toBeVisible();
  await expect(mainWindow.getByTestId("layouts-left")).not.toBeVisible();

  // When
  await mainWindow.keyboard.press("[");

  // Then
  await expect(mainWindow.getByTestId("panel-settings-left")).toBeVisible();
  await expect(mainWindow.getByTestId("topics-left")).toBeVisible();
  await expect(mainWindow.getByTestId("alerts-left")).toBeVisible();
  await expect(mainWindow.getByTestId("layouts-left")).toBeVisible();
});

/**
 * Given the Data Source dialog is closed
 * When the user presses ] on their keyboard
 * Then the right‐sidebar panels are all visible
 * When the user presses ] again
 * Then the right‐sidebar panels are all hidden
 */
test("hide/show right side bar via shortcut", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  // When
  await mainWindow.keyboard.press("]");

  // Then
  await expect(mainWindow.getByTestId("variables-right")).toBeVisible();

  // When
  await mainWindow.keyboard.press("]");

  // Then
  await expect(mainWindow.getByTestId("variables-right")).not.toBeVisible();
});
