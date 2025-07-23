// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "../../../fixtures/electron";
import { loadFile } from "../../../fixtures/load-file";

/**
 * Given the Data Source dialog is closed
 * And the user has loaded the MCAP file "custom-camera-model.mcap"
 *
 * When the user opens the Image panel
 * And the user selects the pinhole camera calibration topic "/camera_calibration"
 * Then no error icons should appear in the sidebar
 *
 * When the user selects the custom camera calibration topic "/camera_calibration/custom"
 * Then exactly one error icon should appear in the sidebar
 * And hovering over that error icon should reveal the message
 * "Unrecognized distortion_model 'CylinderCameraModel' Missing camera info for topic"
 *
 * When the user loads the extension file "custom-camera-model.foxe"
 * And the user re-opens the Image panel
 * And the user selects the custom camera calibration topic "/camera_calibration/custom" again
 * And the user clicks on play
 * Then no error icons should appear on the sidebar
 */
test("custom camera model", async ({ mainWindow }) => {
  await mainWindow.getByTestId("DataSourceDialog").getByTestId("CloseIcon").click();
  /**
   * MCAP structure:
   * /image/compressed - Topic with compressed image
   * /camera_calibration - Topic with camera calibration for Pinhole camera model
   * /camera_calibration/custom - Topic with custom camera calibration (distortion_model = 'CylinderCameraModel')
   */

  // GIVEN
  const mcapFile = "custom-camera-model.mcap";
  await loadFile({
    mainWindow,
    filename: mcapFile,
  });

  // WHEN
  await mainWindow.getByTestId("SettingsIcon").nth(1).click();
  const sidebarLeft = mainWindow.getByTestId("sidebar-left");
  await sidebarLeft.getByText("None", { exact: true }).nth(0).click();
  await mainWindow.getByRole("option", { name: "/camera_calibration", exact: true }).click();

  // THEN
  await mainWindow.waitForTimeout(100); // await for the sidebar to update
  expect(await sidebarLeft.getByTestId("ErrorIcon").count()).toBe(0);

  // WHEN
  await sidebarLeft.getByText("/camera_calibration", { exact: true }).click();
  await mainWindow.getByRole("option", { name: "/camera_calibration/custom", exact: true }).click();
  // Expect errors for custom camera, as the extension has not registered the camera model yet
  const errorIcon = sidebarLeft.getByTestId("ErrorIcon");
  await errorIcon.hover();
  const errorMsg = mainWindow.getByText(
    'Unrecognized distortion_model "CylinderCameraModel" Missing camera info for topic',
  );

  // THEN
  expect(await errorIcon.count()).toBe(1);
  expect(errorMsg).toBeDefined();

  // WHEN
  const foxeFile = "custom-camera-model.foxe";
  await loadFile({
    mainWindow,
    filename: foxeFile,
  });
  await mainWindow.getByTestId("play-button").click();

  // THEN
  await mainWindow.waitForTimeout(100); // await for the sidebar to update
  expect(await sidebarLeft.getByTestId("ErrorIcon").count()).toBe(0);
});
