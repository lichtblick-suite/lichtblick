// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CameraInfo, ICameraModel, Vector3 } from "@lichtblick/suite";

import { PinholeCameraModel } from "./PinholeCameraModel";
import { selectCameraModel } from "./selectCameraModel";

class MockCameraModel implements ICameraModel {
  public cx = 0;
  public cy = 0;
  public fx = 0;
  public fy = 0;
  public height = 10;
  public width = 10;
  public projectPixelTo3dPlane(): Vector3 {
    return {} as Vector3;
  }
  public projectPixelTo3dRay(): Vector3 {
    return {} as Vector3;
  }
}

describe("selectCameraModel", () => {
  const createCameraInfo = (customProps: Partial<CameraInfo> = {}): CameraInfo => {
    return {
      D: new Array(12).fill(0),
      P: new Array(12).fill(1),
      K: new Array(9).fill(0),
      R: new Array(9).fill(0),
      binning_x: 0,
      binning_y: 0,
      distortion_model: "",
      height: 10,
      width: 10,
      roi: {
        do_rectify: false,
        height: 10,
        width: 10,
        x_offset: 0,
        y_offset: 0,
      },
      ...customProps,
    } as CameraInfo;
  };

  it("should return the specific camera model when available", () => {
    const mockCameraModelName = "mock_model";

    const mockCameraInfo = createCameraInfo({ distortion_model: mockCameraModelName });

    const mockCameraModels = new Map([
      [mockCameraModelName, { extensionId: "", modelBuilder: () => new MockCameraModel() }],
    ]);

    const result = selectCameraModel(mockCameraInfo, mockCameraModels);

    expect(result).toBeInstanceOf(MockCameraModel);
  });

  it("should default to PinholeCameraModel when distortion_model not found", () => {
    const mockCameraInfo = createCameraInfo();
    const mockCameraModels = new Map([
      ["TestModel", { extensionId: "", modelBuilder: () => new MockCameraModel() }],
    ]);

    const result = selectCameraModel(mockCameraInfo, mockCameraModels);

    expect(result).toBeInstanceOf(PinholeCameraModel);
  });
});
