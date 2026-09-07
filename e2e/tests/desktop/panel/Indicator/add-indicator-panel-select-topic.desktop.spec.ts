// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";
import { DataSourceDialog, LayoutManager, Panels, Sidebar } from "../../../../page-objects";

const MCAP_FILE = "example.mcap";
const TOPIC_PATH = "mouse.clientX";

/**
 * GIVEN an .mcap file with a "mouse" topic is loaded
 * AND the user creates a new layout and adds an Indicator panel
 * WHEN the user opens the Panel settings tab
 * AND sets the message path to "mouse.clientX"
 * THEN the Indicator panel message path setting should show the selected topic
 */
test("add Indicator panel in a new layout and select a topic", { tag: "@regression" }, async ({
  mainWindow,
}) => {
  const dialog = new DataSourceDialog(mainWindow);
  const sidebar = new Sidebar(mainWindow);
  const layout = new LayoutManager(mainWindow);
  const panels = new Panels(mainWindow);

  // Given
  await dialog.close();
  await loadFiles({ mainWindow, filenames: MCAP_FILE });

  await sidebar.openLayoutsTab();
  await mainWindow.getByTestId("create-new-layout").click();
  await layout.selectPanel("Indicator");

  // When
  await sidebar.openPanelSettingsTab();
  const messagePath = mainWindow.getByPlaceholder("/some/topic.msgs[0].field");
  await panels.setTopicPath(TOPIC_PATH);

  // Then
  await expect(messagePath).toHaveValue(TOPIC_PATH);
});
