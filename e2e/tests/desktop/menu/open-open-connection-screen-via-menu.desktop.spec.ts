// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { AppMenu, DataSourceDialog } from "../../../page-objects";

/**
 * GIVEN the app is on the initial screen
 * WHEN the user opens the File Open... > Open connection menu
 * AND the user clicks on the "Open connection" button
 * THEN the "Open a new connection" dialog should appear
 */
test(
  "Display the open a new connection dialog when clicking File > Open... > Open connection",
  { tag: "@smoke" },
  async ({ mainWindow }) => {
    const dialog = new DataSourceDialog(mainWindow);
    const appMenu = new AppMenu(mainWindow);

    // Given
    await dialog.close();

    // When
    await appMenu.openFile();
    await mainWindow.getByText("Open connection").nth(0).click();

    // Then
    await expect(mainWindow.getByText("Open a new connection", { exact: true })).toBeVisible();
  },
);
