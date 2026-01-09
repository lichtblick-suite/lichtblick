// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";

const MCAP_FILENAME = "example_logs.mcap";

/**
 * GIVEN the user is on the layouts tab
 * AND example_logs.mcap file is loaded
 * WHEN a new layout with Raw Messages panel is created
 * THEN the new layout should show a raw messages with no topics selected
 * WHEN a /rosout topic is selected
 * THEN its messages should be rendered on the panel
 * WHEN raw messages settings are open and font size is changed to 30px
 * THEN messages on the panel should have CSS attribute font size as 30px
 */
test("create a new layout with raw messages panel, select a topic and change the font size", async ({
  mainWindow,
}) => {
  // Given
  await loadFiles({
    mainWindow,
    filenames: MCAP_FILENAME,
  });
  await mainWindow.getByTestId("layouts-left").click();

  // When
  await mainWindow.getByTestId("layout-list-item").getByText("Default", { exact: true }).click();
  await mainWindow.getByText("Create new layout").click();

  const panelSearch = mainWindow.getByTestId("panel-list-textfield").locator("input");
  await panelSearch.fill("Raw Messages");
  await mainWindow.getByText("Raw Messages").nth(0).click();

  // Then
  const playButton = mainWindow.getByRole("button", { name: "Play", exact: true });
  await expect(playButton).toBeEnabled();
  await expect(mainWindow.getByText("No topic selected")).toBeVisible();

  // When
  const topicPathInput = mainWindow.getByPlaceholder("/some/topic.msgs[0].field", { exact: true });
  await topicPathInput.fill("/rosout");

  // Then
  await expect(mainWindow.getByText("No topic selected")).not.toBeVisible();
  const topicMessage = mainWindow.getByText("level 1");
  await expect(topicMessage).toBeVisible();
  await expect(topicMessage).toHaveCSS("font-size", "12px");

  // When
  await mainWindow.getByTestId("panel-settings-left").click();
  await mainWindow.getByTestId("FieldEditor-Select").click();
  await mainWindow.getByText("30 px").click();

  // Then
  await expect(topicMessage).toHaveCSS("font-size", "30px");
});
