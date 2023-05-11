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
    const P = this.P;

    const fx = P[0];
    const fy = P[5];
    const cx = P[2];
    const cy = P[6];
    const tx = P[3];
    const ty = P[7];

    out.x = (pixel.x - cx - tx) / fx;
    out.y = (pixel.y - cy - ty) / fy;
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

  /**
   * Rectifies the given pixel 2D coordinate.
   *
   * @param out - The output rectified 2D pixel coordinate.
   * @param point - The input unrectified 2D pixel to rectify.
   * @param iterations - The number of iterations to use in the iterative optimization.
   * @returns The rectified pixel, a reference to `out`.
   */
  public rectifyPixel(out: Vector2, point: Readonly<Vector2>, iterations = 5): Vector2 {
    const { P, D } = this;
    const [k1, k2, p1, p2, k3] = D;

    const fx = P[0];
    const fy = P[5];
    const cx = P[2];
    const cy = P[6];

    // This method does three things:
    //   1. Convert the input 2D point from pixel coordinates to normalized
    //      coordinates by subtracting the principal point (cx, cy) and dividing
    //      by the focal lengths (fx, fy).
    //   2. Apply the distortion model to the normalized point using an
    //      iterative optimization algorithm. This undoes the distortion that
    //      was applied to the original image and yields an approximation of the
    //      rectified point.
    //   3. Convert the rectified point back to pixel coordinates by multiplying
    //      by the focal lengths and adding the principal point.
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
    const count = k1 !== 0 || k2 !== 0 || p1 !== 0 || p2 !== 0 || k3 !== 0 ? iterations : 1;
    for (let i = 0; i < count; i++) {
      const r2 = x * x + y * y; // squared distance in the image projected by the pinhole model
      const k_inv = 1 / (1 + k1 * r2 + k2 * r2 * r2 + k3 * r2 * r2 * r2);
      const delta_x = 2 * p1 * x * y + p2 * (r2 + 2 * x * x);
      const delta_y = p1 * (r2 + 2 * y * y) + 2 * p2 * x * y;
      x = (x0 - delta_x) * k_inv;
      y = (y0 - delta_y) * k_inv;
    }

    out.x = x * fx + cx;
    out.y = y * fy + cy;
    return out;
  }

  /**
   * Unrectifies the given 2D pixel coordinate.
   *
   * @param out - The output unrectified 2D pixel coordinate
   * @param point - The input rectified 2D pixel coordinate
   * @returns The unrectified pixel, a reference to `out`
   */
  public unrectifyPixel(out: Vector2, point: Readonly<Vector2>): Vector2 {
    out.x = point.x;
    out.y = point.y;

    const { P, R, D, K } = this;
    const fx = P[0];
    const fy = P[5];
    const cx = P[2];
    const cy = P[6];
    const tx = P[3];
    const ty = P[7];

    // Formulae from docs for cv::initUndistortRectifyMap,
    // <https://docs.opencv.org/2.4/modules/calib3d/doc/camera_calibration_and_3d_reconstruction.html>

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
