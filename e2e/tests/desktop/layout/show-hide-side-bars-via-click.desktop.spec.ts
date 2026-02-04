// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

/**
 * Given the Data Source dialog is closed
 * When the user presses clicks on the "Hide left sidebar button"
 * Then the left‐sidebar tabs are all hidden
 * When the user clicks on the "Show left sidebar" button
 * Then the left‐sidebar tabs are all visible
 */
test("show/hide left side bar via click", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  // When
  await mainWindow.getByTestId("left-sidebar-button").click();

  // Then
  await expect(mainWindow.getByTestId("panel-settings-left")).not.toBeVisible();
  await expect(mainWindow.getByTestId("topics-left")).not.toBeVisible();
  await expect(mainWindow.getByTestId("alerts-left")).not.toBeVisible();
  await expect(mainWindow.getByTestId("layouts-left")).not.toBeVisible();

  // When
  await mainWindow.getByTestId("left-sidebar-button").click();

  // Then
  await expect(mainWindow.getByTestId("panel-settings-left")).toBeVisible();
  await expect(mainWindow.getByTestId("topics-left")).toBeVisible();
  await expect(mainWindow.getByTestId("alerts-left")).toBeVisible();
  await expect(mainWindow.getByTestId("layouts-left")).toBeVisible();
});

/**
 * Given the Data Source dialog is closed
 * When the user presses clicks on the "Show right sidebar button"
 * Then the right‐sidebar tabs are all hidden
 * When the user clicks on the "Hide right sidebar" button
 * Then the right‐sidebar tabs are all visible
 */
test("hide/show right side bar via click", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  // When
  await mainWindow.getByTestId("right-sidebar-button").click();

  // Then
  await expect(mainWindow.getByTestId("variables-right")).toBeVisible();

  // When
  await mainWindow.getByTestId("right-sidebar-button").click();

  // Then
  await expect(mainWindow.getByTestId("variables-right")).not.toBeVisible();
});
