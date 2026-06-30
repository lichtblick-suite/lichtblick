// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { DataSourceDialog, ExtensionManager } from "../../../page-objects";

const extensionSourceFolder = "lichtblick.suite-extension-turtlesim-0.0.1";

/**
 * GIVEN turtlesim extension in already on root level folder
 * WHEN the extensions menu is opened
 * AND searched for turtlesim
 * THEN the turtlesim extension should appear on the extensions list
 */
test.use({
  preInstalledExtensions: [extensionSourceFolder],
});

test(
  "should install an extension (user folder)",
  { tag: "@regression" },
  async ({ mainWindow }) => {
    const dialog = new DataSourceDialog(mainWindow);
    const extensions = new ExtensionManager(mainWindow);

    // When
    await dialog.close();

    await extensions.open();
    await extensions.search("turtlesim");
    const turtlesimExtension = extensions.findExtension("turtlesim", "0.0.1");

    // Then
    await expect(turtlesimExtension).toBeVisible();
  },
);
