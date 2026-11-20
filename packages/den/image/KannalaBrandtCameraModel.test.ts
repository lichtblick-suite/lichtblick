// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CameraInfo } from "@lichtblick/suite";

import { KannalaBrandtCameraModel } from "./KannalaBrandtCameraModel";

// IO-AI ego camera 0. The expected rays were computed with OpenCV (`cv2.fisheye.undistortPoints`),
// an independent implementation.
const K = [932.8, 0, 999.1, 0, 930.4, 770.2, 0, 0, 1];
const D = [-0.10913604884540012, 0.01748785466617026, -0.005804454734739265, 0.0010447263612390124];

function cameraInfo(overrides: Partial<CameraInfo> = {}): CameraInfo {
  return {
    width: 2048,
    height: 1536,
    distortion_model: "kannala_brandt",
    D,
    K,
    R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    P: [932.8, 0, 999.1, 0, 0, 930.4, 770.2, 0, 0, 0, 1, 0],
    binning_x: 0,
    binning_y: 0,
    roi: { x_offset: 0, y_offset: 0, height: 0, width: 0, do_rectify: false },
    ...overrides,
  };
}

const REFERENCE: [[number, number], [number, number, number]][] = [
  [
    [999.1, 770.2],
    [0, 0, 1],
  ],
  [
    [1500, 900],
    [0.525976448654, 0.136649735342, 0.839449596636],
  ],
  [
    [200, 150],
    [-0.755034684109, -0.587511496354, 0.291123457392],
  ],
  [
    [1900, 1400],
    [0.812657299339, 0.569576871267, 0.123167778045],
  ],
  [
    [1024, 50],
    [0.02547357664, -0.738690531647, 0.673563208131],
  ],
  [
    [30, 770],
    [-0.931690031573, -0.000192775433, 0.363254246919],
  ],
];

describe("KannalaBrandtCameraModel", () => {
  it("unprojects pixels like OpenCV", () => {
    const model = new KannalaBrandtCameraModel(cameraInfo());
    for (const [pixel, ray] of REFERENCE) {
      const out = model.projectPixelTo3dRay({ x: 0, y: 0, z: 0 }, { x: pixel[0], y: pixel[1] });
      expect(out.x).toBeCloseTo(ray[0], 6);
      expect(out.y).toBeCloseTo(ray[1], 6);
      expect(out.z).toBeCloseTo(ray[2], 6);
    }
  });

  it("projects and unprojects back to the same ray up to 85 degrees off axis", () => {
    const model = new KannalaBrandtCameraModel(cameraInfo());
    for (let deg = 0; deg <= 85; deg += 5) {
      for (let azimuth = 0; azimuth < 360; azimuth += 45) {
        const t = (deg * Math.PI) / 180;
        const a = (azimuth * Math.PI) / 180;
        const ray = { x: Math.sin(t) * Math.cos(a), y: Math.sin(t) * Math.sin(a), z: Math.cos(t) };
        const pixel = model.projectPoint({ x: 0, y: 0 }, ray);
        const back = model.projectPixelTo3dRay({ x: 0, y: 0, z: 0 }, pixel);
        expect(back.x).toBeCloseTo(ray.x, 7);
        expect(back.y).toBeCloseTo(ray.y, 7);
        expect(back.z).toBeCloseTo(ray.z, 7);
      }
    }
  });

  it("returns the ray scaled to z = 1 as the plane projection", () => {
    const model = new KannalaBrandtCameraModel(cameraInfo());
    const pixel = { x: 1500, y: 900 };
    const ray = model.projectPixelTo3dRay({ x: 0, y: 0, z: 0 }, pixel);
    const plane = model.projectPixelTo3dPlane({ x: 0, y: 0, z: 0 }, pixel);
    expect(plane.z).toBe(1);
    expect(plane.x).toBeCloseTo(ray.x / ray.z, 12);
    expect(plane.y).toBeCloseTo(ray.y / ray.z, 12);
  });

  it("rejects other distortion models and malformed messages", () => {
    expect(
      () => new KannalaBrandtCameraModel(cameraInfo({ distortion_model: "plumb_bob" })),
    ).toThrow('Unrecognized distortion_model "plumb_bob"');
    expect(() => new KannalaBrandtCameraModel(cameraInfo({ width: 0 }))).toThrow(
      "Invalid image size",
    );
    expect(() => new KannalaBrandtCameraModel(cameraInfo({ D: [0.1] }))).toThrow("D.length");
    expect(
      () => new KannalaBrandtCameraModel(cameraInfo({ K: [0, 0, 1, 0, 0, 1, 0, 0, 1] })),
    ).toThrow("Invalid focal length");
    expect(() => new KannalaBrandtCameraModel(cameraInfo({ distortion_model: "" }))).not.toThrow();
  });
});
