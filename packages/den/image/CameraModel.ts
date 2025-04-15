// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CameraInfo, CustomCameraInfo } from "./CameraInfo";
import { PinholeCameraModel } from "./PinholeCameraModel";

type Vector2 = { x: number; y: number };
type Vector3 = { x: number; y: number; z: number };

export interface ICameraModel {
  name: string;
  width: number;
  height: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  projectPixelTo3dPlane(out: Vector3, pixel: Readonly<Vector2>): Vector3;
  projectPixelTo3dRay(out: Vector3, pixel: Readonly<Vector2>): Vector3;
  setCameraInfo(customCameraInfo: CustomCameraInfo): void;
}

export class CameraModel implements ICameraModel {
  public name: string;
  public width: number;
  public height: number;
  public fx: number;
  public fy: number;
  public cx: number;
  public cy: number;

  public constructor(
    name: string,
    width: number,
    height: number,
    fx: number,
    fy: number,
    cx: number,
    cy: number,
  ) {
    this.name = name;
    this.width = width;
    this.height = height;
    this.fx = fx;
    this.fy = fy;
    this.cx = cx;
    this.cy = cy;
  }

  public projectPixelTo3dPlane(): Vector3 {
    throw new Error("Method projectPixelTo3dPlane not implemented.");
  }

  public projectPixelTo3dRay(): Vector3 {
    throw new Error("Method projectPixelTo3dRay not implemented.");
  }

  public setCameraInfo(): void {
    throw new Error("Method setCameraInfo not implemented.");
  }

  public static create(
    cameraInfo: CameraInfo | CustomCameraInfo,
    cameraModels: ICameraModel[] = [],
  ): ICameraModel {
    if ("name" in cameraInfo) {
      if (cameraModels.length === 0) {
        throw new Error("No camera models registered. Please register a camera model first.");
      }

      const cameraModel = cameraModels.find((model) => model.name === cameraInfo.name);
      if (!cameraModel) {
        throw new Error(
          `Camera model ${cameraInfo.name} not found. Please register the camera model first.`,
        );
      }

      cameraModel.setCameraInfo(cameraInfo);

      return cameraModel;
    }

    return new PinholeCameraModel(cameraInfo);

    // Standard camera models
    // const { distortion_model } = cameraInfo;
    // switch (distortion_model) {
    //   case "cylindrical":
    //     return new CylinderCameraModel(cameraInfo);
    //   case "deformed_cylinder":
    //     return new DeformedCylinderCameraModel(cameraInfo);
    //   default:
    //     return new PinholeCameraModel(cameraInfo);
    // }
  }
}
