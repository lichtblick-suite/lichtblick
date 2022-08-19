// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import type { CameraInfo } from "./CameraInfo";

type Vector2 = { x: number; y: number };

type Vector3 = { x: number; y: number; z: number };

type Matrix3 = [number, number, number, number, number, number, number, number, number];

// prettier-ignore
type Matrix3x4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

type Vec8 = [number, number, number, number, number, number, number, number];

// Essentially a copy of ROSPinholeCameraModel
// but only the relevant methods, i.e.
// fromCameraInfo() and unrectifyPixel()
// http://docs.ros.org/diamondback/api/image_geometry/html/c++/pinhole__camera__model_8cpp_source.html
export class PinholeCameraModel {
  // [k1, k2, p1, p2, k3, ?, ?, ?]
  public D: Readonly<Vec8>;
  //     [fx  0 cx]
  // K = [ 0 fy cy]
  //     [ 0  0  1]
  public K: Readonly<Matrix3>;
  //     [fx'  0  cx' Tx]
  // P = [ 0  fy' cy' Ty]
  //     [ 0   0   1   0]
  public P: Readonly<Matrix3x4> | undefined;
  public R: Readonly<Matrix3>;
  public readonly width: number;
  public readonly height: number;

  // Mostly copied from `fromCameraInfo`
  // http://docs.ros.org/diamondback/api/image_geometry/html/c++/pinhole__camera__model_8cpp_source.html#l00062
  public constructor(info: CameraInfo) {
    const { binning_x, binning_y, roi, distortion_model: model, D, K, P, R, width, height } = info;
    const fx = P[0];
    const fy = P[5];

    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid image size ${width}x${height}`);
    }
    if (model.length > 0 && model !== "plumb_bob" && model !== "rational_polynomial") {
      throw new Error(`Unrecognized distortion_model "${model}"`);
    }
    if (K.length !== 0 && K.length !== 9) {
      throw new Error(`K.length=${K.length}, expected 9`);
    }
    if (P.length !== 0 && P.length !== 12) {
      throw new Error(`P.length=${K.length}, expected 12`);
    }
    if (R.length !== 0 && R.length !== 9) {
      throw new Error(`R.length=${R.length}, expected 9`);
    }
    if (fx === 0 || fy === 0) {
      throw new Error(`Invalid focal length (fx=${fx}, fy=${fy})`);
    }

    const D8 = [...D];
    while (D8.length < 8) {
      D8.push(0);
    }
    this.D = D8 as Vec8;
    this.K = K.length === 9 ? (K as Matrix3) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.P = P.length === 12 ? (P as Matrix3x4) : undefined;
    this.R = R.length === 9 ? (R as Matrix3) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.width = width;
    this.height = height;

    // Binning = 0 is considered the same as binning = 1 (no binning).
    const binningX = binning_x !== 0 ? binning_x : 1;
    const binningY = binning_y !== 0 ? binning_y : 1;

    const adjustBinning = binningX > 1 || binningY > 1;
    const adjustRoi = roi.x_offset !== 0 || roi.y_offset !== 0;

    if (adjustBinning || adjustRoi) {
      throw new Error(
        "Failed to initialize camera model: unable to handle adjusted binning and adjusted roi camera models.",
      );
    }
  }

  public projectPixelTo3dRay(out: Vector3, pixel: Readonly<Vector2>): boolean {
    const P = this.P;
    if (!P) {
      return false;
    }

    const fx = P[0];
    const fy = P[5];
    const cx = P[2];
    const cy = P[6];
    const tx = P[3];
    const ty = P[7];

    out.x = (pixel.x - cx - tx) / fx;
    out.y = (pixel.y - cy - ty) / fy;
    out.z = 1.0;
    return true;
  }

  public rectifyPixel(out: Vector2, point: Readonly<Vector2>, iterations = 3): Vector2 {
    if (!this.P) {
      out.x = point.x;
      out.y = point.y;
      return out;
    }

    const { P, D } = this;
    const [k1, k2, p1, p2, k3] = D;

    const fx = P[0];
    const fy = P[5];
    const cx = P[2];
    const cy = P[6];

    // This method does three things:
    //   1. Undo the camera matrix
    //   2. Iterative optimization to undo distortion
    //   3. Reapply the camera matrix
    // The distortion model is non-linear, so we use fixed-point iteration to
    // incrementally iterate to an approximation of the solution. This approach
    // is described at <http://peterabeles.com/blog/?p=73>. The Jacobi method is
    // used here, balancing accuracy and speed. A more precise method such as
    // Levenberg-Marquardt or the exact formula described in
    // <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4934233/> could be used,
    // but they are slower and less suitable for real-time applications such as
    // visualization. Note that our method is only locally convergent, requiring
    // a good "initial guess". This means we may not converge for extreme values
    // such as points close to the focal plane.
    //
    // The implementation is based on code from
    // <https://yangyushi.github.io/code/2020/03/04/opencv-undistort.html>
    // You can read more about the equations used in the pinhole camera model at
    // <https://docs.opencv.org/4.x/d9/d0c/group__calib3d.html#details>
    let x = (point.x - cx) / fx;
    let y = (point.y - cy) / fy;

    const x0 = x;
    const y0 = y;
    for (let i = 0; i < iterations; i++) {
      const r2 = x ** 2 + y ** 2; // squared distance in the image projected by the pinhole model
      const k_inv = 1 / (1 + k1 * r2 + k2 * r2 ** 2 + k3 * r2 ** 3);
      const delta_x = 2 * p1 * x * y + p2 * (r2 + 2 * x ** 2);
      const delta_y = p1 * (r2 + 2 * y ** 2) + 2 * p2 * x * y;
      x = (x0 - delta_x) * k_inv;
      y = (y0 - delta_y) * k_inv;
    }

    out.x = x * this.width + cx;
    out.y = y * this.height + cy;
    return out;
  }

  public unrectifyPixel(out: Vector2, point: Readonly<Vector2>): Vector2 {
    if (!this.P) {
      out.x = point.x;
      out.y = point.y;
      return out;
    }

    const { P, R, D, K } = this;
    const fx = P[0];
    const fy = P[5];
    const cx = P[2];
    const cy = P[6];
    const tx = P[3];
    const ty = P[7];

    // Formulae from docs for cv::initUndistortRectifyMap,
    // http://opencv.willowgarage.com/documentation/cpp/camera_calibration_and_3d_reconstruction.html

    // x <- (u - c'x) / f'x
    // y <- (v - c'y) / f'y
    // c'x, f'x, etc. (primed) come from "new camera matrix" P[0:3, 0:3].
    const x1 = (point.x - cx - tx) / fx;
    const y1 = (point.y - cy - ty) / fy;
    // [X Y W]^T <- R^-1 * [x y 1]^T
    const X = R[0] * x1 + R[1] * y1 + R[2];
    const Y = R[3] * x1 + R[4] * y1 + R[5];
    const W = R[6] * x1 + R[7] * y1 + R[8];
    const xp = X / W;
    const yp = Y / W;

    // x'' <- x'(1+k1*r^2+k2*r^4+k3*r^6) + 2p1*x'*y' + p2(r^2+2x'^2)
    // y'' <- y'(1+k1*r^2+k2*r^4+k3*r^6) + p1(r^2+2y'^2) + 2p2*x'*y'
    // where r^2 = x'^2 + y'^2
    const r2 = xp * xp + yp * yp;
    const r4 = r2 * r2;
    const r6 = r4 * r2;
    const a1 = 2 * xp * yp;
    const k1 = D[0]!;
    const k2 = D[1]!;
    const p1 = D[2]!;
    const p2 = D[3]!;
    const k3 = D[4]!;
    let barrel_correction = 1 + k1 * r2 + k2 * r4 + k3 * r6;
    barrel_correction /= 1.0 + D[5] * r2 + D[6] * r4 + D[7] * r6;
    const xpp = xp * barrel_correction + p1 * a1 + p2 * (r2 + 2 * (xp * xp));
    const ypp = yp * barrel_correction + p1 * (r2 + 2 * (yp * yp)) + p2 * a1;

    // map_x(u,v) <- x''fx + cx
    // map_y(u,v) <- y''fy + cy
    // cx, fx, etc. come from original camera matrix K.
    out.x = xpp * K[0] + K[2];
    out.y = ypp * K[4] + K[5];
    return out;
  }
}
