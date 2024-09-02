// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "path";

import { launchApp } from "./launchApp";

describe("open extension", () => {
  it("should import .foxe extension correctly", async () => {
    await using app = await launchApp();

    await app.renderer.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

    const extensionPath = path.resolve(
      __dirname,
      "../../packages/suite-base/src/test/fixtures/lichtblick.suite-extension-turtlesim-0.0.1.foxe",
    );

    const fileInput = app.renderer.locator("[data-puppeteer-file-upload]");
    await fileInput.setInputFiles(extensionPath);

    // Add turtlesim extension
    await app.renderer.getByLabel("Add panel button").click();
    await app.renderer.getByText("Turtle [local]").click();

    await expect(app.renderer.getByText("Turtle", { exact: true }).count()).resolves.toBe(1);
  }, 15_000);
});
