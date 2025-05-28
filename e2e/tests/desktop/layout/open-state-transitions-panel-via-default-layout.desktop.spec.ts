// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

test("open Image panel when clicking on Layouts > layout", async ({ mainWindow }) => {
  // Given
  // Close startup dialog
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  // When
  // Click on Panels tab
  await mainWindow.getByTestId("panel-settings-left").click();
  // Click on State Transitions Panel
  await mainWindow.getByText("Image").nth(0).click();

  // Then
  // The State Transitions panel settings are shown
  await expect(mainWindow.getByText("Image panel", { exact: true }).count()).resolves.toBe(1);
});
