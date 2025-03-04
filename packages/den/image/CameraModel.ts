// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CameraInfo } from "./CameraInfo";
import { CylinderCameraModel } from "./CylinderCameraModel";
import { PinholeCameraModel } from "./PinholeCameraModel";
import { DeformedCylinderCameraModel } from "./DeformedCylinderCameraModel";

export type CameraModel = PinholeCameraModel | CylinderCameraModel | DeformedCylinderCameraModel;

export function createCameraModel(cameraInfo: CameraInfo): CameraModel {
  if (
    cameraInfo.distortion_model === "plumb_bob" ||
    cameraInfo.distortion_model === "rational_polynomial"
  ) {
    return new PinholeCameraModel(cameraInfo);
  } else if (cameraInfo.distortion_model === "cylindrical") {
    return new CylinderCameraModel(cameraInfo);
  } else if (cameraInfo.distortion_model === "deformed_cylinder") {
    return new DeformedCylinderCameraModel(cameraInfo);
  } else {
    throw new Error(`Unsupported camera model: ${cameraInfo.distortion_model}`);
  }
}
