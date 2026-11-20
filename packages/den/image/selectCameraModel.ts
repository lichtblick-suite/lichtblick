// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CameraInfo, ICameraModel } from "@lichtblick/suite";

import { KANNALA_BRANDT_MODEL_NAME, KannalaBrandtCameraModel } from "./KannalaBrandtCameraModel";
import { PinholeCameraModel } from "./PinholeCameraModel";
import { CameraModelsMap } from "./types";

export const selectCameraModel = (
  cameraInfo: CameraInfo,
  cameraModels: CameraModelsMap,
): ICameraModel => {
  const cameraModel = cameraModels.get(cameraInfo.distortion_model);
  if (cameraModel) {
    return cameraModel.modelBuilder(cameraInfo);
  }
  // built-in fisheye model; an extension registering the same name takes precedence (above)
  if (cameraInfo.distortion_model === KANNALA_BRANDT_MODEL_NAME) {
    return new KannalaBrandtCameraModel(cameraInfo);
  }
  return new PinholeCameraModel(cameraInfo);
};
