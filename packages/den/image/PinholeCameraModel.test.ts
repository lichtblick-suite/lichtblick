// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CameraInfo } from "./CameraInfo";
import { PinholeCameraModel } from "./PinholeCameraModel";

// Example real-world plumb_bob distortion parameters
const D1 = [
  -0.363528858080088, 0.16117037733986861, -8.1109585007538829e-5, -0.00044776712298447841, 0.0,
];

// The values in these tests are taken from the ROS Noetic Python implementation of image_geometry
// using the following script:
// ```python
// from image_geometry import PinholeCameraModel
// from sensor_msgs.msg import CameraInfo

// import math

// width = 640.0
// height = 480.0
// fov = 60
// cx = width / 2.0
// cy = height / 2.0
// fx = width / (2.0 * math.tan((fov * math.pi) / 360.0))
// fy = fx

// msg = CameraInfo()
// msg.height = height
// msg.width = width
// msg.distortion_model = ''
// msg.K = [fx,  0.0, cx, 0.0, fy,  cy, 0.0, 0.0, 1.0]
// msg.R = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]
// msg.P = [fx,  0.0, cx,  0.0, 0.0, fx,  cy,  0.0, 0.0, 0.0, 1.0, 0.0]

// model = PinholeCameraModel()
// model.fromCameraInfo(msg)
// print("projectPixelTo3dRay((100.0, 100.0))", model.projectPixelTo3dRay((100.0, 100.0)))
// print("projectPixelTo3dRay((0.0, 0.0))", model.projectPixelTo3dRay((0.0, 0.0)))
// print("rectifyPoint((320.0, 240.0))", model.rectifyPoint((320.0, 240.0)))
// print("rectifyPoint((100.0, 100.0))", model.rectifyPoint((100.0, 100.0)))

// msg.distortion_model = "plumb_bob"
// msg.D = [-0.363528858080088, 0.16117037733986861, -8.1109585007538829e-05, -0.00044776712298447841, 0.0]
// model.fromCameraInfo(msg)
// print("projectPixelTo3dRay((100.0, 100.0))", model.projectPixelTo3dRay((100.0, 100.0)))
// print("rectifyPoint((320.0, 240.0))", model.rectifyPoint((320.0, 240.0)))
// print("rectifyPoint((0.0, 0.0))", model.rectifyPoint((0.0, 0.0)))
// ```

const closeTo = (expected: number, precision = 8) => ({
  asymmetricMatch: (actual: number) => Math.abs(expected - actual) < Math.pow(10, -precision) / 2,
});

function makeCameraInfo(
  width: number,
  height: number,
  fov: number,
  distortionModel = "",
  D = [0, 0, 0, 0, 0, 0, 0, 0],
): CameraInfo {
  const cx = width / 2;
  const cy = height / 2;
  const fx = width / (2 * Math.tan((fov * Math.PI) / 360));
  const fy = fx;
  return {
    D,
    // prettier-ignore
    K: [
      fx, 0, cx,
      0, fy, cy,
      0, 0, 1,
    ],
    R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    // prettier-ignore
    P: [
      fx, 0, cx, 0,
      0, fy, cy, 0,
      0,  0,  1, 0,
    ],
    width,
    height,
    binning_x: 0,
    binning_y: 0,
    distortion_model: distortionModel,
    roi: { x_offset: 0, y_offset: 0, do_rectify: false, height: 0, width: 0 },
  };
}

describe("PinholeCameraModel", () => {
  it("projectPixelTo3dPlane", () => {
    const model = new PinholeCameraModel(makeCameraInfo(640, 480, 90));
    const point = { x: 0, y: 0, z: 0 };

    model.projectPixelTo3dPlane(point, { x: 320, y: 240 });
    expect(point).toEqual({ x: 0, y: 0, z: 1 });

    model.projectPixelTo3dPlane(point, { x: 100, y: 100 });
    expect(point).toMatchObject({
      x: closeTo(-0.6875),
      y: closeTo(-0.4375),
      z: 1,
    });
  });

  it("projectPixelTo3dRay", () => {
    let model = new PinholeCameraModel(makeCameraInfo(640, 480, 90));
    const ray = { x: 0, y: 0, z: 0 };

    model.projectPixelTo3dRay(ray, { x: 320, y: 240 });
    expect(ray).toEqual({ x: 0, y: 0, z: 1 });

    model.projectPixelTo3dRay(ray, { x: 100, y: 100 });
    expect(ray).toMatchObject({
      x: closeTo(-0.5329517414226601),
      y: closeTo(-0.33915110817805644),
      z: closeTo(0.7752025329784149),
    });

    model = new PinholeCameraModel(makeCameraInfo(640, 480, 60));
    model.projectPixelTo3dRay(ray, { x: 0, y: 0 });
    expect(ray).toMatchObject({
      x: closeTo(-0.4681645887845223),
      y: closeTo(-0.3511234415883917),
      z: closeTo(0.8108848540793832),
    });
  });

  it("undistortPixel - no distortion", () => {
    const model = new PinholeCameraModel(makeCameraInfo(640, 480, 45));
    const rectified = { x: 0, y: 0 };

    model.undistortPixel(rectified, { x: 320, y: 240 });
    expect(rectified).toEqual({ x: 320, y: 240 });

    model.undistortPixel(rectified, { x: 100, y: 100 });
    expect(rectified).toMatchObject({ x: closeTo(100), y: closeTo(100) });
  });

  it("undistortPixel - plumb_bob", () => {
    const model = new PinholeCameraModel(makeCameraInfo(640, 480, 60, "plumb_bob", D1));
    const rectified = { x: 0, y: 0 };

    model.undistortPixel(rectified, { x: 320, y: 240 });
    expect(rectified).toEqual({ x: 320, y: 240 });

    model.undistortPixel(rectified, { x: 0, y: 0 });
    expect(rectified).toMatchObject({
      x: closeTo(-72.45696739),
      y: closeTo(-54.4783923),
    });
  });

  it("distortPixel - no distortion", () => {
    const model = new PinholeCameraModel(makeCameraInfo(640, 480, 45));
    const unrectified = { x: 0, y: 0 };

    model.distortPixel(unrectified, { x: 320, y: 240 });
    expect(unrectified).toEqual({ x: 320, y: 240 });

    model.distortPixel(unrectified, { x: 0, y: 0 });
    expect(unrectified).toMatchObject({
      x: closeTo(0),
      y: closeTo(0),
    });
  });

  it("distortPixel - plumb_bob", () => {
    const model = new PinholeCameraModel(makeCameraInfo(640, 480, 60, "plumb_bob", D1));
    const rectified = { x: 0, y: 0 };
    const unrectified = { x: 0, y: 0 };

    model.undistortPixel(rectified, { x: 0, y: 0 });
    model.distortPixel(unrectified, rectified);
    expect(unrectified).toMatchObject({
      // low precision comparison since we're approximating a nonlinear function
      x: closeTo(0, 1),
      y: closeTo(0, 1),
    });
  });
});
