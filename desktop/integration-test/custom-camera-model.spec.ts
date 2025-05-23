// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { launchApp } from "./launchApp";
import { loadFile } from "./utils/loadFile";

describe("custom camera model", () => {
  it("should import .foxe extension correctly", async () => {
    await using app = await launchApp();
    await app.renderer.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();

    // Install MCAP with new custom camera model topic
    /**
     * MCAP structure:
     * /image/compressed - Topic with compressed image
     * /camera_calibration - Topic with camera calibration for Pinhole camera model
     * /camera_calibration/custom - Topic with custom camera calibration (distortion_model = 'CylinderCameraModel')
     */
    await loadFile(app, "../../../packages/suite-base/src/test/fixtures/custom-camera-model.mcap");

    // Open image settings
    await app.renderer.getByTestId("SettingsIcon").nth(1).click();
    const sidebarLeft = app.renderer.getByTestId("sidebar-left");

    // Select Pinhole camera calibration
    await sidebarLeft.getByRole("button", { name: "None​", exact: true }).nth(0).click();
    await app.renderer.getByRole("option", { name: "/camera_calibration", exact: true }).click();

    // No errors for Pinhole
    expect(await sidebarLeft.getByTestId("ErrorIcon").count()).toBe(0);

    // Select custom camera calibration
    await sidebarLeft.getByRole("button", { name: "/camera_calibration", exact: true }).click();
    await app.renderer
      .getByRole("option", { name: "/camera_calibration/custom", exact: true })
      .click();

    // Expect errors for custom camera, as the extension has not registered the camera model yet
    const errorIcon = sidebarLeft.getByTestId("ErrorIcon");
    await errorIcon.hover();
    const errorMsg = app.renderer.getByText(
      'Unrecognized distortion_model "CylinderCameraModel" Missing camera info for topic',
    );

    expect(await errorIcon.count()).toBe(1);
    expect(errorMsg).toBeDefined();

    // Install the extension to register a new custom camera model named 'CylinderCameraModel'
    await loadFile(app, "../../../packages/suite-base/src/test/fixtures/custom-camera-model.foxe");

    // Select again the camera calibration custom
    await sidebarLeft.getByRole("button", { name: "None​", exact: true }).nth(0).click();
    await app.renderer
      .getByRole("option", { name: "/camera_calibration/custom", exact: true })
      .click();

    // No more errors for custom camera model
    expect(await sidebarLeft.getByTestId("ErrorIcon").count()).toBe(0);
  }, 15_000);
});
