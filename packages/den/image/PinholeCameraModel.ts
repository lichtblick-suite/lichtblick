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
 * A pinhole camera model that can be used to rectify, unrectify, and project pixel coordinates.
 * Based on `ROSPinholeCameraModel` from the ROS `image_geometry` package. See
 * <http://docs.ros.org/diamondback/api/image_geometry/html/c++/pinhole__camera__model_8cpp_source.html>
 *
 * See also <http://wiki.ros.org/image_pipeline/CameraInfo>
 */
export class PinholeCameraModel {
  /**
   * Distortion parameters `[k1, k2, p1, p2, k3, k4, k5, k6]`. For `rational_polynomial`, all eight
   * parameters are set. For `plumb_bob`, the last three parameters are set to zero. For no
   * distortion model, all eight parameters are set to zero.
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
   * Projection/camera matrix. 3x4 row-major matrix.
   * This matrix specifies the intrinsic (camera) matrix of the processed (rectified) image. That
   * is, the left 3x3 portion is the normal camera intrinsic matrix for the rectified image.
   *
   * It projects 3D points in the camera coordinate frame to 2D pixel coordinates using the focal
   * lengths `(fx', fy')` and principal point `(cx', cy')` - these may differ from the values in K.
   * For monocular cameras, `Tx = Ty = 0`. Normally, monocular cameras will also have R = the
   * identity and `P[1:3,1:3] = K`.
   *
   * For a stereo pair, the fourth column `[Tx Ty 0]'` is related to the position of the optical
   * center of the second camera in the first camera's frame. We assume `Tz = 0` so both cameras are
   * in the same stereo image plane. The first camera always has `Tx = Ty = 0`. For the right
   * (second) camera of a horizontal stereo pair, `Ty = 0 and Tx = -fx' * B`, where `B` is the
   * baseline between the cameras.
   *
   * Given a 3D point `[X Y Z]'`, the projection `(x, y)` of the point onto the rectified image is
   * given by:
   * ```
   * [u v w]' = P * [X Y Z 1]'
   *        x = u / w
   *        y = v / w
   * ```
   * This holds for both images of a stereo pair.
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
   * Undoes camera distortion to map a given coordinate from normalized raw image coordinates to
   * normalized undistorted coordinates.
   *
   * This method uses an iterative optimization algorithm to undo the distortion that was applied to
   * the original image and yields an approximation of the undistorted point.
   *
   * @param out - The output vector to receive the undistorted 2D normalized coordinate.
   * @param point - The input distorted 2D normalized coordinate.
   * @param iterations - The number of iterations to use in the iterative optimization.
   * @returns The undistorted pixel, a reference to `out`.
   */
  public undistortNormalized(out: Vector2, point: Readonly<Vector2>, iterations = 5): Vector2 {
    const { D } = this;
    const [k1, k2, p1, p2, k3, k4, k5, k6] = D;

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
    // initUndistortRectifyMap and undistortPoints from OpenCV.
    // You can read more about the equations used in the pinhole camera model at
    // <https://docs.opencv.org/4.x/d9/d0c/group__calib3d.html#details>

    // See also https://github.com/opencv/opencv/blob/192099352577d18b46840cdaf3cbf365e4c6e663/modules/calib3d/src/undistort.dispatch.cpp

    let x = point.x;
    let y = point.y;
    const x0 = x;
    const y0 = y;
    const count = k1 !== 0 || k2 !== 0 || p1 !== 0 || p2 !== 0 || k3 !== 0 ? iterations : 1;
    for (let i = 0; i < count; ++i) {
      const xx = x * x;
      const yy = y * y;
      const xy = x * y;
      const r2 = xx + yy;
      const r4 = r2 * r2;
      const r6 = r4 * r2;

      const cdist = 1 + k1 * r2 + k2 * r4 + k3 * r6;
      const icdist = (1 + k4 * r2 + k5 * r4 + k6 * r6) / cdist;
      const deltaX = 2 * p1 * xy + p2 * (r2 + 2 * xx);
      const deltaY = p1 * (r2 + 2 * yy) + 2 * p2 * xy;
      x = (x0 - deltaX) * icdist;
      y = (y0 - deltaY) * icdist;
    }

    out.x = x;
    out.y = y;
    return out;
  }

  /**
   * Applies camera distortion parameters to map a given pixel coordinate from normalized
   * undistorted image coordinates to normalized raw coordinates.
   *
   * @param out - The output vector to receive the distorted 2D normalized coordinate
   * @param point - The input undistorted 2D normalized coordinate
   * @returns The distorted pixel, a reference to `out`
   */
  public distortNormalized(out: Vector2, point: Readonly<Vector2>): Vector2 {
    const { R, D } = this;
    const [k1, k2, p1, p2, k3, k4, k5, k6] = D;

    // Formulae from:
    // <https://docs.opencv.org/2.4/modules/calib3d/doc/camera_calibration_and_3d_reconstruction.html>

    const x1 = point.x;
    const y1 = point.y;

    // [X Y W]^T <- R^-1 * [x y 1]^T
    const X = R[0] * x1 + R[3] * y1 + R[6];
    const Y = R[1] * x1 + R[4] * y1 + R[7];
    const W = R[2] * x1 + R[5] * y1 + R[8];
    const xp = X / W;
    const yp = Y / W;

    // x'' <- x'(1+k1*r^2+k2*r^4+k3*r^6) / (1 + k4_ * r2 + k5_ * r4 + k6_ * r6) + 2p1*x'*y' + p2(r^2+2x'^2)
    // y'' <- y'(1+k1*r^2+k2*r^4+k3*r^6) / (1 + k4_ * r2 + k5_ * r4 + k6_ * r6) + p1(r^2+2y'^2) + 2p2*x'*y'
    // where r^2 = x'^2 + y'^2

    const xx = xp * xp;
    const yy = yp * yp;
    const xy = xp * yp;
    const r2 = xx + yy;
    const r4 = r2 * r2;
    const r6 = r4 * r2;

    const cdist = (1 + k1 * r2 + k2 * r4 + k3 * r6) / (1 + k4 * r2 + k5 * r4 + k6 * r6);
    const deltaX = 2 * p1 * xy + p2 * (r2 + 2 * xx);
    const deltaY = 2 * p2 * xy + p1 * (r2 + 2 * yy);
    out.x = xp * cdist + deltaX;
    out.y = yp * cdist + deltaY;

    return out;
  }

  /**
   * Undoes camera distortion to map a given pixel coordinate from a raw image to an undistorted image.
   * Similar to OpenCV `undistortPoints()`.
   *
   * @param out - The output undistorted 2D pixel coordinate.
   * @param point - The input distorted 2D pixel coordinate.
   * @param iterations - The number of iterations to use in the iterative optimization.
   * @returns The undistorted pixel, a reference to `out`.
   */
  public undistortPixel(out: Vector2, point: Readonly<Vector2>, iterations = 5): Vector2 {
    const { K, P } = this;
    const fx = K[0];
    const fy = K[4];
    const cx = K[2];
    const cy = K[5];
    const fpx = P[0];
    const fpy = P[5];
    const cpx = P[2];
    const cpy = P[6];

    // Undo K to get normalized coordinates
    out.x = (point.x - cx) / fx;
    out.y = (point.y - cy) / fy;

    // Undo distortion
    this.undistortNormalized(out, out, iterations);

    // Apply K' to get pixel coordinates in the rectified image
    out.x = out.x * fpx + cpx;
    out.y = out.y * fpy + cpy;
    return out;
  }

  /**
   * Applies camera distortion parameters to a given 2D pixel coordinate on an undistorted image,
   * returning the corresponding pixel coordinate on the raw (distorted) image.
   *
   * @param out - The output 2D pixel coordinate on the original (distorted) image
   * @param point - The input 2D pixel coordinate on an undistorted image
   * @returns The distorted pixel, a reference to `out`
   */
  public distortPixel(out: Vector2, point: Readonly<Vector2>): Vector2 {
    out.x = point.x;
    out.y = point.y;

    const { P, K } = this;
    const fx = K[0];
    const fy = K[4];
    const cx = K[2];
    const cy = K[5];

    const fxp = P[0];
    const fyp = P[5];
    const cxp = P[2];
    const cyp = P[6];

    // x <- (u - c'x) / f'x
    // y <- (v - c'y) / f'y
    // c'x, f'x, etc. (primed) come from "new camera matrix" P[0:3, 0:3].
    out.x = (point.x - cxp) / fxp;
    out.y = (point.y - cyp) / fyp;

    this.distortNormalized(out, out);

    // map_x(u,v) <- x''fx + cx
    // map_y(u,v) <- y''fy + cy
    // cx, fx, etc. come from original camera matrix K.
    out.x = out.x * fx + cx;
    out.y = out.y * fy + cy;
    return out;
  }

  /**
   * Projects a 2D image pixel to a point on a plane in 3D world coordinates a
   * unit distance along the Z axis. This is equivalent to `projectPixelTo3dRay`
   * before normalizing.
   *
   * @param out - The output vector to receive the 3D point.
   * @param pixel - The 2D image pixel coordinate.
   * @returns `true` if the projection was successful, or `false` if the camera
   *   projection matrix `P` is not set.
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
    this.undistortNormalized(out, out);

    out.z = 1.0;
    return out;
  }

  /**
   * Projects a 2D image pixel into a 3D ray in world coordinates. This is
   * equivalent to normalizing the result of `projectPixelTo3dPlane` to get a
   * direction vector.
   *
   * @param out - The output vector to receive the 3D ray direction.
   * @param pixel - The 2D image pixel coordinate.
   * @returns `true` if the projection was successful, or `false` if the camera
   *   projection matrix `P` is not set.
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
