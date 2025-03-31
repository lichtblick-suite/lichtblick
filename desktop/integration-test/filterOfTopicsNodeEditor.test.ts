// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AppType, launchApp } from "./launchApp";
import { loadFile } from "./utils/loadFile";

describe("filterOfTopics", () => {
  const closeDataSourceDialogAfterAppLaunch = async (app: AppType) => {
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(true);
    await app.renderer.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
    await expect(app.renderer.getByTestId("DataSourceDialog").isVisible()).resolves.toBe(false);
  };

  it("should filter the visible and invisible", async () => {
    await using app = await launchApp();
    await closeDataSourceDialogAfterAppLaunch(app);

    /**
     * Load a file with 4 topics on 3D panel:
     * /image_raw
     * /radar/points
     * /velodyne_packets
     * /velodyne_points
     **/
    await loadFile(app, "../../../packages/suite-base/src/test/fixtures/demo-shuffled.bag");

    // Open settings menu
    const settingsIcon = app.renderer.getByTestId("SettingsIcon").nth(0);
    await settingsIcon.click();

    // Make the first topic visible
    const visibilityButtons = app.renderer.getByTitle("Toggle visibility");
    await visibilityButtons.nth(0).click();

    expect(await visibilityButtons.count()).toBe(4);

    // Select only visibles
    await app.renderer.getByRole("button", { name: "List all" }).click();
    await app.renderer.locator("#menu-").getByText("List visible").click();
    expect(await app.renderer.getByTitle("Toggle visibility").count()).toBe(1);

    // Select only invisibles
    await app.renderer.getByRole("button", { name: "List visible" }).click();
    await app.renderer.locator("#menu-").getByText("List invisible").click();
    expect(await app.renderer.getByTitle("Toggle visibility").count()).toBe(3);

    // Select all
    await app.renderer.getByRole("button", { name: "List invisible" }).click();
    await app.renderer.locator("#menu-").getByText("List all").click();
    expect(await app.renderer.getByTitle("Toggle visibility").count()).toBe(4);
  }, 20_000);
});
