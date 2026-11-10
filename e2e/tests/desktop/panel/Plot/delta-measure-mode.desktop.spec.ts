// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";
import { Sidebar } from "../../../../page-objects";

const MCAP_FILENAME = "example-2.mcap";
const SERIES_PATH = "mouse.clientX";

const openPlotWithSeries = async (
  mainWindow: Parameters<typeof loadFiles>[0]["mainWindow"],
): Promise<void> => {
  await loadFiles({ mainWindow, filenames: MCAP_FILENAME });

  const sidebar = new Sidebar(mainWindow);
  await sidebar.openLayoutsTab();
  await mainWindow.getByTestId("create-new-layout").click();
  await sidebar.openPanelSettingsTab();
  await mainWindow.getByText("Plot", { exact: true }).nth(0).click();
  await mainWindow.getByTestId("add-series").click();
  await mainWindow.getByPlaceholder("/some/topic.msgs[0].field").fill(SERIES_PATH);
  await expect(mainWindow.getByTestId("plot-legend-row-path-label")).toHaveText(SERIES_PATH);
};

/**
 * GIVEN a Plot panel contains a numeric series
 * WHEN the user enables measure mode and clicks on the plot
 * THEN the delta overlay should be visible while the mode remains active
 */
test("should show the delta overlay after selecting plot points", {
  tag: "@regression",
}, async ({ mainWindow }) => {
  // Given
  await openPlotWithSeries(mainWindow);
  const toggle = mainWindow.getByTestId("plot-measure-mode-toggle");
  const canvas = mainWindow.getByTestId("vertical-bar-wrapper").locator("canvas");

  // When
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const bounds = await canvas.boundingBox();
  if (!bounds) {
    throw new Error("Plot canvas is not rendered");
  }

  await mainWindow.mouse.click(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.6);
  await mainWindow.mouse.click(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.5);

  // Then
  await expect(mainWindow.getByTestId("delta-overlay")).toBeVisible();
});

/**
 * GIVEN a Plot panel is in measure mode
 * WHEN the user toggles measure mode off again
 * THEN the overlay should disappear and the toggle should be inactive
 */
test("should hide the delta overlay when measure mode is turned off", {
  tag: "@regression",
}, async ({ mainWindow }) => {
  // Given
  await openPlotWithSeries(mainWindow);
  const toggle = mainWindow.getByTestId("plot-measure-mode-toggle");
  await toggle.click();
  await expect(mainWindow.getByTestId("delta-overlay")).toBeVisible();

  // When
  await toggle.click();

  // Then
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(mainWindow.getByTestId("delta-overlay")).toBeHidden();
});
