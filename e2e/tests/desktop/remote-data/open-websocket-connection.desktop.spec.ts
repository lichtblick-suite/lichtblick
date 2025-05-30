// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { launchWebsocket } from "../../../fixtures/launch-websocket";

/**
 * GIVEN there is a WebSocket server is running
 * WHEN the user opens the File Open... > Open connection menu
 * AND the user clicks on the "Open connection" button
 * THEN the address ws://localhost:8765 should be visible
 * WHEN the user clicks on the "Topics" tab
 * THEN the topic "/websocket_test" should appear in the list
 * AND data should be correctly displayed in the "Raw Messages" panel
 */
test("show correctly open a web socket connection showing correct attibutes on raw messages panel", async ({
  mainWindow,
}) => {
  // Given
  const websocketServer = launchWebsocket();

  // When
  await mainWindow.getByText("Open connection").click();
  await mainWindow.getByText("Open", { exact: true }).click();

  // Then
  await expect(mainWindow.getByText("ws://localhost:8765").innerHTML()).resolves.toBeDefined();

  // When
  await mainWindow.getByText("Topics", { exact: true }).click();
  await expect(mainWindow.getByText("/websocket_test").innerHTML()).resolves.toBeDefined();
  await mainWindow.getByTestId("AddPanelButton").click();
  await mainWindow.getByText("Raw Messages").click();
  await mainWindow.getByPlaceholder("/some/topic.msgs[0].field").nth(0).click();
  await mainWindow.getByTestId("autocomplete-item").click();

  const rawMessagesPanel = mainWindow.getByTestId(/RawMessages/);
  await rawMessagesPanel.getByText("data").nth(0).click();
  const attributesToCheck = ["hello", '"world"', "foo", "42"];

  // Then
  for (const attribute of attributesToCheck) {
    await expect(rawMessagesPanel.getByText(attribute, { exact: true }).innerText()).resolves.toBe(
      attribute,
    );
  }

  void websocketServer.close();
});
