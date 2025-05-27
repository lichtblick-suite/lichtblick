// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test, expect } from "../../../fixtures/electron";
import { launchWebsocket } from "../../../fixtures/launch-websocket";

test("show correctly open a web socket connection showing correct attibutes on raw messages panel", async ({
  mainWindow,
}) => {
  const websocketServer = launchWebsocket();

  await mainWindow.getByText("Open connection").click();
  await mainWindow.getByText("Open", { exact: true }).click();

  // Show connection to "ws://localhost:8765", it is located on top bar
  await expect(mainWindow.getByText("ws://localhost:8765").innerHTML()).resolves.toBeDefined();

  // Check if system is listed on topics menu
  await mainWindow.getByText("Topics", { exact: true }).click();
  await expect(mainWindow.getByText("/websocket_test").innerHTML()).resolves.toBeDefined();

  // Add raw messages panel to check messages
  await mainWindow.getByTestId("AddPanelButton").click();
  await mainWindow.getByText("Raw Messages").click();

  // Select the topic
  await mainWindow.getByPlaceholder("/some/topic.msgs[0].field").nth(0).click();
  await mainWindow.getByTestId("autocomplete-item").click();

  const rawMessagesPanel = mainWindow.getByTestId(/RawMessages/);

  //Expanding the data parent to check for attributes
  await rawMessagesPanel.getByText("data").click();

  // Check if message is correctly beeing displayed
  const attributesToCheck = ["hello", '"world"', "foo", "42"];

  for (const attribute of attributesToCheck) {
    await expect(rawMessagesPanel.getByText(attribute, { exact: true }).innerText()).resolves.toBe(
      attribute,
    );
  }

  void websocketServer.close();
});
