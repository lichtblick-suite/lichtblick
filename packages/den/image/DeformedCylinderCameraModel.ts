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
 * A deformable cylindrical camera model that can be used to rectify, unrectify, and project pixel coordinates.
 *
 * This model extends the basic cylindrical projection by introducing a deformation that adapts
 * to image regions near the top and bottom. In these regions, a spherical projection is applied,
 * with the transition determined by a "cut" parameter extracted from the distortion parameters.
 */
export class DeformedCylinderCameraModel {
  /**
   * Distortion parameters for the deformable cylindrical model.
   *
   * The parameters `[k1, k2, p1, p2, k3, k4, k5, k6]` encode both the standard cylindrical distortion
   * and the additional deformation. In many cases, the sixth parameter (`k4`) represents the cut angle
   * that separates the cylindrical region from the spherical (deformed) regions at the top and bottom.
   * Unused parameters are set to zero.
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
    if (model.length > 0 && model !== "deformed_cylinder") {
      throw new Error(`Unrecognized distortion_model "${model}"`);
    }
    if (K.length !== 0 && K.length !== 9) {
      throw new Error(`K.length=${K.length}, expected 9`);
    }
    if (P.length !== 12) {
      throw new Error(`P.length=${P.length}, expected 12`);
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
   * Projects a 2D image pixel to a 3D point on the unit deformed cylinder.
   *
   * This function first determines whether the pixel is in the central cylindrical region
   * or in one of the deformed (spherical) regions at the top or bottom of the image. For the
   * cylindrical region, the horizontal coordinate is interpreted as an angle (theta) around the
   * cylinder. For pixels in the top or bottom deformed regions, a spherical inverse projection is applied.
   *
   * @param out - The output vector to receive the 3D point coordinates.
   * @param pixel - The 2D image pixel coordinate.
   * @returns The 3D point on the deformed cylindrical surface corresponding to the input pixel.
   */
  public projectPixelTo3dPlane(out: Vector3, pixel: Readonly<Vector2>): Vector3 {
    const { K, D } = this;
    const fx = K[0];
    const fy = K[4];
    const cx = K[2];
    const cy = K[5];
    const cut_angle = D[5];

    const cut_height = Math.tan(cut_angle);
    const cut_height_pixels = cut_height * fy;

    if (pixel.y < cy - cut_height_pixels) {
      // top
      out = this.sphericalProjectionInverse(out, pixel, -cut_height);
      //   out.x = 0;
      //   out.y = 0;
      //   out.z = -1;
    } else if (pixel.y > cy + cut_height_pixels) {
      // bottom
      out = this.sphericalProjectionInverse(out, pixel, cut_height);
      //   out.x = 0;
      //   out.y = 0;
      //   out.z = -1;
    } else {
      // Undo K to get normalized coordinates
      out.x = (pixel.x - cx) / fx;
      out.y = (pixel.y - cy) / fy;
      out.z = 1.0;

      const inverse_ray_length = 1 / Math.sqrt(out.y * out.y + 1);

      const theta = out.x;
      out.x = Math.sin(theta) * inverse_ray_length;
      out.y = out.y * inverse_ray_length;
      out.z = Math.cos(theta) * inverse_ray_length;
    }

    return out;
  }

  /**
   * Applies the inverse spherical projection for pixels in the deformed regions.
   *
   * This helper function is used for pixels near the top or bottom of the image. It "unsqueezes"
   * the image coordinates based on a pixel-dependent squeeze factor and applies a spherical
   * projection inverse to recover the corresponding 3D point.
   *
   * @param out - The output vector to receive the 3D point.
   * @param pixel - The 2D image pixel coordinate.
   * @param cut_height - The vertical offset (in normalized units) corresponding to the cut.
   * @returns The 3D point derived from the inverse spherical projection.
   */
  private sphericalProjectionInverse(
    out: Vector3,
    pixel: Readonly<Vector2>,
    cut_height: number,
  ): Vector3 {
    const { K } = this;
    const fx = K[0];
    const fy = K[4];
    const cx = K[2];
    const cy = K[5];

    const pixel_ratio = 1.0 - pixel.x / cx;
    const squeeze_factor = 1.0 - 0.375 * pixel_ratio ** 2;

    out.x = (pixel.x - cx) / fx;
    out.y = (pixel.y - (cy + fy * cut_height)) / (fy * squeeze_factor);

    const theta = Math.hypot(out.x, out.y);
    const phi = Math.atan2(out.y, out.x);
    const sin_theta = Math.sin(theta);

    out.x = sin_theta * Math.cos(phi);
    out.y = sin_theta * Math.sin(phi) + cut_height;
    out.z = Math.cos(theta);

    return out;
  }

  /**
   * Projects a 2D image pixel into a normalized 3D ray direction for the deformable cylindrical camera model.
   *
   * This function maps the pixel to a point on the deformed cylindrical (or spherical) surface using the
   * intrinsic parameters and the deformation model, then normalizes the resulting vector to yield a
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
