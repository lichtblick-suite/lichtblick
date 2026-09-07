// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";
import { Sidebar } from "../../../page-objects";

/**
 * GIVEN a file is loaded and a new layout is created
 * WHEN the user opens a Plot panel and adds a series with "mouse.clientX"
 * THEN "mouse.clientX" should appear in the Plot panel as the path of the added series
 */
test("open Plot panel when clicking on Layouts > layout", { tag: "@regression" }, async ({
  mainWindow,
}) => {
  // Given a file is loaded and a new layout is created with a Plot panel
  const filename = "example-2.mcap";
  await loadFiles({
    mainWindow,
    filenames: filename,
  });

  const sidebar = new Sidebar(mainWindow);

  await sidebar.openLayoutsTab();
  await mainWindow.getByTestId("create-new-layout").click();

  // When
  // the user opens a Plot panel and adds a series with "mouse.clientX"
  await sidebar.openPanelSettingsTab();
  await mainWindow.getByText("Plot").nth(0).click();

  await mainWindow.getByTestId("add-series").click();
  await mainWindow.getByPlaceholder("/some/topic.msgs[0].field").fill("mouse.clientX");

  // Then
  // "mouse.clientX" should appear in the Plot panel as the path of the added series
  await expect(mainWindow.getByTestId("plot-legend-row-path-label").first()).toHaveText(
    "mouse.clientX",
  );
});
