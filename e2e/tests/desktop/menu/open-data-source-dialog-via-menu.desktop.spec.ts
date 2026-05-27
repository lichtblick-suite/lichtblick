// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { AppMenu, DataSourceDialog } from "../../../page-objects";

/**
 * GIVEN the app is on the initial screen
 * WHEN the user opens the File > Open... menu
 * THEN the Data Source dialog should appear
 */
test(
  "Display the data source dialog when clicking File > Open...",
  { tag: "@smoke" },
  async ({ mainWindow }) => {
    const dialog = new DataSourceDialog(mainWindow);
    const appMenu = new AppMenu(mainWindow);

    // Given
    await dialog.close();

    // When
    await appMenu.openFile();

    // Then
    await expect(dialog.isVisible()).resolves.toBe(true);
  },
);
