// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";

/**
 * GIVEN
 */
test.use({
  preInstalledExtensions: ["lichtblick.suite-extension-turtlesim-0.0.1.foxe"],
});

test("should install an extension (user folder)", async ({ mainWindow }) => {
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

  // When
  await mainWindow.getByTestId("user-button").click();
  await mainWindow.getByRole("menuitem", { name: "Extensions" }).click();
  
});
