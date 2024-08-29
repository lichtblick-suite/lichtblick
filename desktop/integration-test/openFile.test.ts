// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "path";

import { AppType, launchApp } from "./launchApp";

describe("openFiles", () => {
  const closeDataSourceDialogAfterAppLaunch = async (app: AppType) => {
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(true);
    await app.renderer.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(false);
  };

  it("should open the rosbag file when dragging and dropping it", async () => {
    await using app = await launchApp();
    await closeDataSourceDialogAfterAppLaunch(app);

    //Add rosbag file from source
    const filePath = path.resolve(
      __dirname,
      "../../packages/suite-base/src/test/fixtures/example.bag",
    );

    //Expect that there are not preloaded files
    await expect(
      app.renderer.getByText("No data source", { exact: true }).innerText(),
    ).resolves.toBe("No data source");

    //Drag and drop file
    const fileInput = app.renderer.locator("[data-puppeteer-file-upload]");
    await fileInput.setInputFiles(filePath);

    //Expect that the file is being shown
    await expect(app.renderer.getByText("example.bag", { exact: true }).innerText()).resolves.toBe(
      "example.bag",
    );
  }, 20_000);
});
