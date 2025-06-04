// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export type FloatArray = number[] | Float32Array | Float64Array;

export type DistortionModel = "plumb_bob" | "rational_polynomial" | (string & {});

export type CameraInfo = Readonly<{
  width: number;
  height: number;
  binning_x: number;
  binning_y: number;
  roi: {
    x_offset: number;
    y_offset: number;
    height: number;
    width: number;
    do_rectify: boolean;
  };
  distortion_model: DistortionModel;
  D: FloatArray;
  K: FloatArray;
  P: FloatArray;
  R: FloatArray;
}>;

export type Vector2 = { x: number; y: number };
export type Vector3 = { x: number; y: number; z: number };

export interface ICameraModel {
  width: number;
  height: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  projectPixelTo3dPlane(out: Vector3, pixel: Readonly<Vector2>): Vector3;
  projectPixelTo3dRay(out: Vector3, pixel: Readonly<Vector2>): Vector3;
}

export type CameraModelBuilder = (info: CameraInfo) => ICameraModel;

export type RegisterCameraModelArgs = {
  name: DistortionModel;
  modelBuilder: CameraModelBuilder;
};
