// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";

const LAYOUT_FILENAME = "layout-e2e.json";
/**
 * GIVEN the "layout-e2e" layout file is loaded
 * WHEN the user clicks on the Layouts sidebar button
 * THEN the "layout-e2e" layout should be displayed in the layout list
 */
test("open layout via drag and drop", async ({ mainWindow }) => {
  // Given
  await loadFiles({
    mainWindow,
    filenames: LAYOUT_FILENAME,
  });

  // When
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  await mainWindow.getByTestId("layouts-left").click();

  // Then
  await expect(mainWindow.getByText("layout-e2e", { exact: true }).count()).resolves.toBe(1);
});
