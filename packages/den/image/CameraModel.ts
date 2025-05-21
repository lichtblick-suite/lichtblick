// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@lichtblick/log";
import { CameraInfo, CameraModelsMap, ICameraModel } from "@lichtblick/suite";

import { PinholeCameraModel } from "./PinholeCameraModel";

const log = Logger.getLogger(__filename);

export const selectCameraModel = (
  cameraInfo: CameraInfo,
  cameraModels: CameraModelsMap,
): ICameraModel => {
  const selectedCameraModel = cameraModels.get("CylinderCameraModel");
  log.debug("distortion_model", cameraInfo.distortion_model);
  log.debug("selectedCameraModel", selectedCameraModel);
  if (selectedCameraModel) {
    log.debug("returning");
    return selectedCameraModel(cameraInfo);
  }
  return new PinholeCameraModel(cameraInfo);
};
