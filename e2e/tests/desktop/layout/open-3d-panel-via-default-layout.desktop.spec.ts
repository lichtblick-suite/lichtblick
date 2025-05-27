// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";

test("open 3D panel when clicking on Layouts > layout", async ({ mainWindow }) => {
  // Given
  // Close startup dialog
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  // Click on Layouts tab
  await mainWindow.getByTestId("layouts-left").click();
  // And click on default layout
  await mainWindow.getByTestId("layout-list-item").getByText("layout", { exact: true }).click();

  // When
  // Click on Panels tab
  await mainWindow.getByTestId("panel-settings-left").click();
  // Click on 3D Panel
  await mainWindow.getByText("3D").nth(0).click();

  // Then
  // The 3D panel settings are shown
  await expect(mainWindow.getByText("3D panel", { exact: true }).count()).resolves.toBe(1);
});
