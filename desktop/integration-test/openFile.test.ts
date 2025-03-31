// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AppType, launchApp } from "./launchApp";
import { loadFile } from "./utils/loadFile";

describe("openFiles", () => {
  const closeDataSourceDialogAfterAppLaunch = async (app: AppType) => {
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(true);
    await app.renderer.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(false);
  };

  it("should open the rosbag file when dragging and dropping it and then switch to an mcap", async () => {
    await using app = await launchApp();
    await closeDataSourceDialogAfterAppLaunch(app);

    //Expect that there are not preloaded files
    await expect(
      app.renderer.getByText("No data source", { exact: true }).innerText(),
    ).resolves.toBe("No data source");

    await loadFile(app, "../../../packages/suite-base/src/test/fixtures/example.bag");

    //Expect that the bag file is being shown
    await expect(
      app.renderer.getByText("example.bag", { exact: true }).innerText(),
    ).resolves.toBeDefined();

    await loadFile(app, "../../../packages/suite-base/src/test/fixtures/example.mcap");

    //Expect that the mcap file is being shown
    await expect(
      app.renderer.getByText("example.mcap", { exact: true }).innerText(),
    ).resolves.toBeDefined();
  }, 20_000);
});
