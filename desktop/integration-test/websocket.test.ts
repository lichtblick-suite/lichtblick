// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { launchApp } from "./launchApp";
import { launchWebsocket } from "./launchWebsocket";

describe("websocket connection", () => {
  it("should show correct attributes using custom test and raw messages panel", async () => {
    const websocketServer = launchWebsocket();

    const app = await launchApp();

    await app.renderer.getByText("Open connection").click();
    await app.renderer.getByText("Open", { exact: true }).click();

    // Show connection to "ws://localhost:8765 websocket-test-server", it is located on top bar
    await expect(
      app.renderer.getByText("ws://localhost:8765 websocket-test-server").innerHTML(),
    ).resolves.toBeDefined();

    // Check if system is listed on topics menu
    await app.renderer.getByText("Topics", { exact: true }).click();
    await expect(app.renderer.getByText("/websocket_test").innerHTML()).resolves.toBeDefined();

    // Add raw messages panel to check messages
    await app.renderer.getByLabel("Add panel button").click();
    await app.renderer.getByText("Raw Messages").click();

    // Select the topic
    await app.renderer.getByPlaceholder("/some/topic.msgs[0].field").nth(0).click();
    await app.renderer.getByTestId("autocomplete-item").click();

    const rawMessagesPanel = app.renderer.getByTestId(/RawMessages/);

    // Check if message is correctly beeing displayed
    const attributesToCheck = ["hello", '"world"', "foo", "42"];

    for (const attribute of attributesToCheck) {
      await expect(
        rawMessagesPanel.getByText(attribute, { exact: true }).innerText(),
      ).resolves.toBe(attribute);
    }

    await app.main.close();

    void websocketServer.close();
  }, 15_000);
});
