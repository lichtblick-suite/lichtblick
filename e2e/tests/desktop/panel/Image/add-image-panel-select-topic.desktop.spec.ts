// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";
import { DataSourceDialog, LayoutManager, Sidebar } from "../../../../page-objects";

const MCAP_FILE = "custom-camera-model.mcap";
const IMAGE_TOPIC = "/image/compressed";

/**
 * GIVEN an .mcap file with an image topic is loaded
 * AND the user creates a new layout and adds an Image panel
 * WHEN the user opens the Panel settings tab
 * AND selects the image topic "/image/compressed"
 * THEN the Image panel Topic setting should show the selected topic
 */
test("add Image panel in a new layout and select a topic", { tag: "@regression" }, async ({
  mainWindow,
}) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);

  // Given
  await dialog.close();
  await loadFiles({ mainWindow, filenames: MCAP_FILE });

  await sidebar.openLayoutsTab();
  await mainWindow.getByTestId("create-new-layout").click();
  await layout.selectPanel("Image");

  // When
  await sidebar.openPanelSettingsTab();
  const settings = sidebar.getLeftSidebar();
  const topicSelect = settings.getByTestId("FieldEditor-Select").getByText(IMAGE_TOPIC);
  await topicSelect.click();
  await mainWindow.getByRole("option", { name: IMAGE_TOPIC, exact: true }).click();

  // Then
  await expect(topicSelect).toHaveText(IMAGE_TOPIC);
});
