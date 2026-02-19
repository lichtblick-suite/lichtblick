// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { loadFiles } from "../../../fixtures/load-files";

/**
 * Given the file example.bag is loaded
 * When a global variable with value 'turtle1' is created
 * And the user clicks on play
 * Then "No topic selected" should be visible on the Raw Messages panel
 *
 * When Raw Messages is filtered for `/tf.transforms[:]{child_frame_id==$globalVariable}`
 * Then a message with `child_frame_id` equal to "turtle1" should be visible
 */
test("Create global variable and use it on Raw Messages Panel", async ({ mainWindow }) => {
  // Given
  const filename = "example.bag";
  await loadFiles({
    mainWindow,
    filenames: filename,
  });

  // When
  await mainWindow.getByTestId("right-sidebar-button").click();
  await mainWindow.getByTestId("add-variable-button").click();

  const newVariableNameInput = mainWindow.getByPlaceholder("variable_name");
  await newVariableNameInput.fill("globalVariable");
  const newVariableValueInput = mainWindow.getByTestId("global-variable-value-input");

  await newVariableValueInput.click();
  await newVariableValueInput.press("Control+A");
  await newVariableValueInput.press("Backspace");
  await newVariableValueInput.fill('"turtle1"');

  await mainWindow.getByRole("button", { name: "Play", exact: true }).click();

  // Then
  await expect(mainWindow.getByText("No topic selected")).toBeVisible();

  // When
  const rawMessagesInputBar = mainWindow.getByPlaceholder("/some/topic.msgs[0].field");
  await rawMessagesInputBar.fill("/tf.transforms[:]{child_frame_id==$globalVariable}");

  // Then
  await expect(mainWindow.getByText('child_frame_id "turtle1"')).toBeVisible();
});
