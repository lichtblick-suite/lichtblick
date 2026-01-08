// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFromFilePicker } from "../../../fixtures/load-from-file-picker";

const LAYOUT_FILE = "default-layout.json";

test("Import a layout via layout tab > import layout", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();
  await loadFromFilePicker(mainWindow, LAYOUT_FILE);

  // When
  await mainWindow.getByRole("button", { name: "Import from file…" }).click();

  // Then
  await expect(
    mainWindow.getByTestId("layout-list-item").getByText("default-layout", { exact: true }),
  ).toBeVisible();
});

test("Import a layout via menu > view > import layout", async ({ mainWindow }) => {
  // Given
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();
  await loadFromFilePicker(mainWindow, LAYOUT_FILE);

  // When
  await mainWindow.getByTestId("AppMenuButton").click();
  await mainWindow.getByTestId("app-menu-view").click();
  await mainWindow.getByText("Import layout from file…").click();

  // Then
  await expect(
    mainWindow.getByTestId("layout-list-item").getByText("default-layout", { exact: true }),
  ).toBeVisible();
});
