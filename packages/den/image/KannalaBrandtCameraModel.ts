// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CameraInfo, ICameraModel, Vector2, Vector3 } from "@lichtblick/suite";

export const KANNALA_BRANDT_MODEL_NAME = "kannala_brandt";

const MAX_NEWTON_ITERATIONS = 20;
const MIN_PLANE_Z = 1e-6;

/**
 * Kannala-Brandt ("OpenCV fisheye") camera model, selected by `CameraInfo` / `CameraCalibration`
 * messages with `distortion_model: "kannala_brandt"`.
 *
 * `K = [fx 0 cx; 0 fy cy; 0 0 1]` and `D = [k1 k2 k3 k4]`. With `theta` the angle between a ray and
 * the optical axis, the distorted radius is
 * `r(theta) = theta * (1 + k1 theta^2 + k2 theta^4 + k3 theta^6 + k4 theta^8)`, and a ray
 * `(x, y, z)` projects to `(fx * r * x / hypot(x, y) + cx, fy * r * y / hypot(x, y) + cy)`.
 * Fields of view up to 180 degrees are supported. `P`, `R` and the binning / ROI fields are ignored.
 */
export class KannalaBrandtCameraModel implements ICameraModel {
  public readonly width: number;
  public readonly height: number;
  public readonly fx: number;
  public readonly fy: number;
  public readonly cx: number;
  public readonly cy: number;
  /** Distortion coefficients `[k1, k2, k3, k4]`. */
  public readonly D: readonly [number, number, number, number];

  public constructor(info: CameraInfo) {
    const { width, height } = info;
    if (!(width > 0 && height > 0)) {
      throw new Error(`Invalid image size ${width}x${height}`);
    }
    const model = info.distortion_model;
    if (model.length > 0 && model !== KANNALA_BRANDT_MODEL_NAME) {
      throw new Error(`Unrecognized distortion_model "${model}"`);
    }
    if (info.K.length !== 9) {
      throw new Error(`K.length=${info.K.length}, expected 9`);
    }
    if (info.D.length < 4) {
      throw new Error(`D.length=${info.D.length}, expected at least 4 (k1 k2 k3 k4)`);
    }
    this.width = width;
    this.height = height;
    this.fx = info.K[0]!;
    this.fy = info.K[4]!;
    this.cx = info.K[2]!;
    this.cy = info.K[5]!;
    if (this.fx === 0 || this.fy === 0) {
      throw new Error(`Invalid focal length (fx=${this.fx}, fy=${this.fy})`);
    }
    this.D = [info.D[0]!, info.D[1]!, info.D[2]!, info.D[3]!];
  }

  /** The angle from the optical axis for a distorted radius `thetaD`, the inverse of `r(theta)` (Newton). */
  #theta(thetaD: number): number {
    const [k1, k2, k3, k4] = this.D;
    let theta = thetaD;
    for (let i = 0; i < MAX_NEWTON_ITERATIONS; i++) {
      const t2 = theta * theta;
      const f = theta * (1 + t2 * (k1 + t2 * (k2 + t2 * (k3 + t2 * k4)))) - thetaD;
      const df = 1 + t2 * (3 * k1 + t2 * (5 * k2 + t2 * (7 * k3 + t2 * 9 * k4)));
      if (Math.abs(df) < 1e-9) {
        break;
      }
      const step = f / df;
      theta -= step;
      if (Math.abs(step) < 1e-12) {
        break;
      }
    }
    return theta;
  }

  /** Projects a pixel of the raw (distorted) image to a unit ray in the camera frame. */
  public projectPixelTo3dRay(out: Vector3, pixel: Readonly<Vector2>): Vector3 {
    const x = (pixel.x - this.cx) / this.fx;
    const y = (pixel.y - this.cy) / this.fy;
    const thetaD = Math.hypot(x, y);
    if (thetaD < 1e-12) {
      out.x = 0;
      out.y = 0;
      out.z = 1;
      return out;
    }
    const theta = this.#theta(thetaD);
    const scale = Math.sin(theta) / thetaD;
    out.x = x * scale;
    out.y = y * scale;
    out.z = Math.cos(theta);
    return out;
  }

  /**
   * Projects a pixel to the point of its ray on the plane `z = 1`. Rays at or beyond 90 degrees have
   * no such point and are clamped to a large finite one.
   */
  public projectPixelTo3dPlane(out: Vector3, pixel: Readonly<Vector2>): Vector3 {
    this.projectPixelTo3dRay(out, pixel);
    const z = Math.max(out.z, MIN_PLANE_Z);
    out.x /= z;
    out.y /= z;
    out.z = 1;
    return out;
  }

  /** The raw image pixel of a point in the camera frame (the inverse of `projectPixelTo3dRay`). */
  public projectPoint(out: Vector2, point: Readonly<Vector3>): Vector2 {
    const [k1, k2, k3, k4] = this.D;
    const radius = Math.hypot(point.x, point.y);
    const theta = Math.atan2(radius, point.z);
    const t2 = theta * theta;
    const rd = theta * (1 + t2 * (k1 + t2 * (k2 + t2 * (k3 + t2 * k4))));
    const s = radius < 1e-12 ? 1 : rd / radius;
    out.x = this.fx * point.x * s + this.cx;
    out.y = this.fy * point.y * s + this.cy;
    return out;
  }
}
