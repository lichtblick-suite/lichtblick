// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { PinholeCameraModel } from "@foxglove/den/image";

const DEFAULT_CAMERA_STATE = {
  near: 0.001,
  far: 1000,
};

const MIN_USER_ZOOM = 0.5;
const MAX_USER_ZOOM = 50;
export const DEFAULT_ZOOM_MODE = "fit";

export class ImageModeCamera extends THREE.PerspectiveCamera {
  #model?: PinholeCameraModel;
  readonly #cameraState = DEFAULT_CAMERA_STATE;
  #zoomMode: "fit" | "fill" | "custom" = DEFAULT_ZOOM_MODE;

  /** x/y zoom factors derived from image and window aspect ratios and zoom mode */
  readonly #aspectZoom = new THREE.Vector2();
  readonly #canvasSize = new THREE.Vector2();

  /** Amount the user has panned, measured in screen pixels */
  readonly #panOffset = new THREE.Vector2(0, 0);
  /** Amount the user has zoomed with the scroll wheel */
  #userZoom = 1;

  public updateCamera(cameraModel: PinholeCameraModel | undefined): void {
    this.#model = cameraModel;
    this.#updateProjection();
  }

  public setPanOffset(offset: THREE.Vector2): void {
    this.#panOffset.copy(offset);
    this.#updateProjection();
  }

  public getPanOffset(out: THREE.Vector2): void {
    out.copy(this.#panOffset);
  }

  public resetModifications(): void {
    this.#panOffset.set(0, 0);
    this.#userZoom = 1;
    this.#updateProjection();
  }

  public setZoomMode(mode: "fit" | "fill" | "custom"): void {
    this.#zoomMode = mode;
    this.#updateProjection();
  }

  public updateZoomFromWheel(ratio: number, cursorCoords: THREE.Vector2): void {
    const newZoom = THREE.MathUtils.clamp(this.#userZoom * ratio, MIN_USER_ZOOM, MAX_USER_ZOOM);
    const finalRatio = newZoom / this.#userZoom;
    const halfWidth = this.#canvasSize.width / 2;
    const halfHeight = this.#canvasSize.height / 2;
    // Adjust pan offset so the zoom is centered around the mouse location
    this.#panOffset.set(
      (halfWidth + this.#panOffset.x - cursorCoords.x) * finalRatio - halfWidth + cursorCoords.x,
      (halfHeight + this.#panOffset.y - cursorCoords.y) * finalRatio - halfHeight + cursorCoords.y,
    );
    this.#userZoom = newZoom;
    this.#updateProjection();
  }

  #updateProjection(): void {
    this.#updateAspectScaledZoom();

    const projection = this.#getProjection();

    if (projection) {
      this.projectionMatrix.copy(projection);
      this.projectionMatrixInverse.copy(projection).invert();
    } else {
      this.updateProjectionMatrix();
    }
  }

  /**
   * Get Perspective projection matrix from this.cameraModel.model
   * @returns the projection matrix for the current camera model, or undefined if no camera model is available
   */
  #getProjection(): THREE.Matrix4 | undefined {
    const model = this.#model;
    if (!model) {
      return;
    }

    // Adapted from https://github.com/ros2/rviz/blob/ee44ccde8a7049073fd1901dd36c1fb69110f726/rviz_default_plugins/src/rviz_default_plugins/displays/camera/camera_display.cpp#L615
    // focal lengths
    const fx = model.P[0];
    const fy = model.P[5];
    // (cx, cy) image center in pixel coordinates
    // for panning we can take offsets from this in pixel coordinates
    const scale = this.getEffectiveScale();
    const cx = model.P[2] + this.#panOffset.x / scale;
    const cy = model.P[6] + this.#panOffset.y / scale;
    const { width, height } = model;

    const zoom = this.#aspectZoom;
    const zoomX = zoom.x;
    const zoomY = zoom.y;
    const near = this.#cameraState.near;
    const far = this.#cameraState.far;

    // prettier-ignore
    const matrix = new THREE.Matrix4()
        .set(
          2.0*fx/width * zoomX, 0, 2.0*(0.5 - cx/width) * zoomX, 0,
          0, 2.0*fy/height * zoomY, 2.0*(cy/height-0.5) * zoomY, 0,
          0, 0, -(far+near)/(far-near), -2.0*far*near/(far-near),
          0, 0, -1.0, 0,
        );

    return matrix;
  }

  /** Set canvas size in CSS pixels */
  public setCanvasSize(width: number, height: number): void {
    this.#canvasSize.set(width, height);
    this.#updateProjection();
  }

  /** @returns The ratio of CSS pixels per image pixel */
  public getEffectiveScale(): number {
    if (!this.#model) {
      return 1;
    }
    return Math.min(
      (this.#canvasSize.width / this.#model.width) * this.#aspectZoom.x,
      (this.#canvasSize.height / this.#model.height) * this.#aspectZoom.y,
    );
  }

  /**
   * Uses the camera model to compute the zoom factors to preserve the aspect ratio of the image.
   */
  #updateAspectScaledZoom(): void {
    const model = this.#model;
    if (!model) {
      return;
    }
    // Adapted from https://github.com/ros2/rviz/blob/ee44ccde8a7049073fd1901dd36c1fb69110f726/rviz_default_plugins/src/rviz_default_plugins/displays/camera/camera_display.cpp#L568
    this.#aspectZoom.set(this.#userZoom, this.#userZoom);

    const { width: imgWidth, height: imgHeight } = model;

    const fx = model.P[0]!;
    const fy = model.P[5]!;
    const rendererAspect = this.#canvasSize.width / this.#canvasSize.height;
    const imageAspect = imgWidth / fx / (imgHeight / fy);
    // preserve the aspect ratio
    const shrinkY =
      this.#zoomMode === "fit" ? imageAspect > rendererAspect : imageAspect < rendererAspect;
    if (shrinkY) {
      this.#aspectZoom.y = (this.#aspectZoom.y / imageAspect) * rendererAspect;
    } else {
      this.#aspectZoom.x = (this.#aspectZoom.x / rendererAspect) * imageAspect;
    }
  }
}
