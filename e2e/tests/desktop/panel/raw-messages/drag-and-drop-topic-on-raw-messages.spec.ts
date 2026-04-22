// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { expect, test } from "../../../../fixtures/electron";
import { loadFiles } from "../../../../fixtures/load-files";

/**
 * GIVEN a file is loaded and a new layout is created with a Raw Messages panel
 * WHEN the user opens the Topics sidebar and drags a topic onto the panel
 * THEN the topic message data is displayed in the Raw Messages panel
 */
test("open Raw Messages panel when clicking on Layouts > layout", async ({ mainWindow }) => {
  // GIVEN a file is loaded and a new layout is created with a Raw Messages panel
  const filename = "example-2.mcap";
  await loadFiles({
    mainWindow,
    filenames: filename,
  });

  await mainWindow.getByTestId("layouts-left").click();
  await mainWindow.getByTestId("create-new-layout").click();
  await mainWindow.getByText("Raw Messages").nth(0).click();

  // WHEN the user opens the Topics sidebar and drags a topic onto the panel
  await mainWindow.getByTestId("topics-left").click();
  await mainWindow.getByTestId("topic-row").dragTo(mainWindow.getByTestId("workspace-panels"));

  // THEN the topic message data is displayed in the Raw Messages panel
  const topicMessageClientX = mainWindow.getByText("clientX");
  const topicMessageClientY = mainWindow.getByText("clientY");
  await expect(topicMessageClientX).toBeVisible();
  await expect(topicMessageClientY).toBeVisible();
});
