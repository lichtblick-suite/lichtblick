// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

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

/**
 * A cylindrical camera model that can be used to rectify, unrectify, and project pixel coordinates.
 *
 * In this model the image is assumed to be formed by projecting the scene onto a cylindrical surface.
 * The intrinsic matrix `K` represents the parameters of the raw (cylindrically distorted) image,
 * while the projection matrix `P` relates to the processed cylindrical projection.
 */
export class CylinderCameraModel {
  /**
   * Distortion parameters `[k1, k2, p1, p2, k3, k4, k5, k6]`. All eight parameters shall be set to zero.
   */
  public D: Readonly<Vec8>;
  /**
   * Intrinsic camera matrix for the raw (distorted) images. 3x3 row-major matrix.
   * ```
   *     [fx  0 cx]
   * K = [ 0 fy cy]
   *     [ 0  0  1]
   * ```
   * Projects 3D points in the camera coordinate frame to 2D pixel coordinates using the focal
   * lengths `(fx, fy)` and principal point `(cx, cy)`.
   */
  public K: Readonly<Matrix3>;
  /**
   * Projection matrix (not applicable for cylindrical model)
   */
  public P: Readonly<Matrix3x4>;
  /**
   * Rectification matrix (stereo cameras only). 3x3 row-major matrix.
   * A rotation matrix aligning the camera coordinate system to the ideal stereo image plane so
   * that epipolar lines in both stereo images are parallel.
   */
  public R: Readonly<Matrix3>;
  /** The full camera image width in pixels. */
  public readonly width: number;
  /** The full camera image height in pixels. */
  public readonly height: number;

  // Mostly copied from `fromCameraInfo`
  // <http://docs.ros.org/diamondback/api/image_geometry/html/c++/pinhole__camera__model_8cpp_source.html#l00064>
  public constructor(info: CameraInfo) {
    const { binning_x, binning_y, roi, distortion_model: model, D, K, P, R, width, height } = info;
    const fx = K[0];
    const fy = K[4];

    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid image size ${width}x${height}`);
    }
    if (model.length > 0 && model !== "cylindrical") {
      throw new Error(`Unrecognized distortion_model "${model}"`);
    }
    if (K.length !== 0 && K.length !== 9) {
      throw new Error(`K.length=${K.length}, expected 9`);
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
    this.P = P as Matrix3x4;
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

  /**
   * Projects a 2D image pixel onto a 3D point on the unit cylinder.
   *
   * This function first removes the effect of the intrinsic parameters to obtain normalized
   * coordinates. It then maps the horizontal coordinate to an angle (in radians) around the
   * cylinder and computes the corresponding 3D point on a cylindrical surface at unit distance.
   *
   * @param out - The output vector to receive the 3D point coordinates.
   * @param pixel - The 2D image pixel coordinate.
   * @returns The 3D point on the unit cylinder corresponding to the input pixel.
   */
  public projectPixelTo3dPlane(out: Vector3, pixel: Readonly<Vector2>): Vector3 {
    const { K } = this;
    const fx = K[0];
    const fy = K[4];
    const cx = K[2];
    const cy = K[5];

    // Undo K to get normalized coordinates
    out.x = (pixel.x - cx) / fx;
    out.y = (pixel.y - cy) / fy;
    out.z = 1.0;

    const theta = out.x;
    out.x = Math.sin(theta);
    out.z = Math.cos(theta);

    return out;
  }

  /**
   * Projects a 2D image pixel into a normalized 3D ray direction for the cylindrical camera model.
   *
   * This function first maps the pixel to a point on the unit cylinder using the intrinsic
   * parameters and cylindrical geometry, then normalizes the resulting vector to yield a
   * unit-length direction.
   *
   * @param out - The output vector to receive the 3D ray direction.
   * @param pixel - The 2D image pixel coordinate.
   * @returns The normalized 3D ray direction corresponding to the input pixel.
   */
  public projectPixelTo3dRay(out: Vector3, pixel: Readonly<Vector2>): Vector3 {
    this.projectPixelTo3dPlane(out, pixel);

    // Normalize the ray direction
    const invNorm = 1.0 / Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z);
    out.x *= invNorm;
    out.y *= invNorm;
    out.z *= invNorm;

    return out;
  }
}
