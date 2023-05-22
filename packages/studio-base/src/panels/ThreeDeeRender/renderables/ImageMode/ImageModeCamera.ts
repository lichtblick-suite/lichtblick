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
  #rotation: 0 | 90 | 180 | 270 = 0;
  #flipHorizontal = false;
  #flipVertical = false;

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

  public setRotation(rotation: 0 | 90 | 180 | 270): void {
    // guard against invalid rotation values
    switch (rotation) {
      case 0:
      case 90:
      case 180:
      case 270:
        this.#rotation = rotation;
        break;
      default:
        this.#rotation = 0;
        break;
    }

    // By default the camera is facing down the -y axis with -z up,
    // where the image is on the +y axis with +z up.
    // To correct this we rotate the camera 180 degrees around the x axis.
    this.quaternion.setFromEuler(new THREE.Euler(Math.PI, 0, THREE.MathUtils.degToRad(rotation)));

    this.resetModifications();
  }

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  public setFlipHorizontal(flipHorizontal: boolean): void {
    this.#flipHorizontal = flipHorizontal;
    this.resetModifications();
  }

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  public setFlipVertical(flipVertical: boolean): void {
    this.#flipVertical = flipVertical;
    this.resetModifications();
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
    this.#updateAspectZoom();

    if (this.#model) {
      this.#getProjection(this.projectionMatrix, this.#model);
      this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
    } else {
      this.updateProjectionMatrix();
    }
  }

  /**
   * Get perspective projection matrix from the camera model, accounting for zoom, pan, and aspect fit.
   *
   * Adapted from https://github.com/ros2/rviz/blob/ee44ccde8a7049073fd1901dd36c1fb69110f726/rviz_default_plugins/src/rviz_default_plugins/displays/camera/camera_display.cpp#L615
   *
   * @returns the projection matrix for the current camera model, or undefined if no camera model is available
   */
  #getProjection(out: THREE.Matrix4, model: PinholeCameraModel) {
    const { width, height } = model;

    // focal lengths
    const fx = model.P[0];
    const fy = model.P[5];

    // (cx, cy) image center in pixel coordinates
    // for panning we can take offsets from this in pixel coordinates
    const scale = this.getEffectiveScale();
    const flipPanX = this.#flipHorizontal ? -1 : 1;
    const flipPanY = this.#flipVertical ? -1 : 1;
    let panX, panY;
    switch (this.#rotation) {
      case 0:
        panX = this.#panOffset.x * (fx / fy) * flipPanX;
        panY = this.#panOffset.y * flipPanY;
        break;
      case 90:
        panX = this.#panOffset.y * (fx / fy) * flipPanY;
        panY = -this.#panOffset.x * flipPanX;
        break;
      case 180:
        panX = -this.#panOffset.x * (fx / fy) * flipPanX;
        panY = -this.#panOffset.y * flipPanY;
        break;
      case 270:
        panX = -this.#panOffset.y * (fx / fy) * flipPanY;
        panY = this.#panOffset.x * flipPanX;
        break;
    }
    const cx = model.P[2] + panX / scale;
    const cy = model.P[6] + panY / scale;

    const near = this.#cameraState.near;
    const far = this.#cameraState.far;

    // Calculate coordinates of the canvas/viewport edges relative to the center of the camera frame.
    let left: number, right: number, top: number, bottom: number;
    // Adjustments to center point keep the image centered based on the orientation and fit mode
    const xOffset = ((1 / this.#aspectZoom.x - 1) * width) / 2;
    const yOffset = ((1 / this.#aspectZoom.y - 1) * height) / 2;
    // These are the original values for rotation == 0:
    const left0 = (-(cx + xOffset) / fx) * near;
    const right0 = ((width - cx + xOffset) / fx) * near;
    const top0 = ((cy + yOffset) / fy) * near;
    const bottom0 = (-(height - cy + yOffset) / fy) * near;
    switch (this.#rotation) {
      case 0:
        left = left0;
        right = right0;
        top = top0;
        bottom = bottom0;
        break;
      case 90:
        left = bottom0;
        right = top0;
        top = -left0;
        bottom = -right0;
        break;
      case 180:
        left = -right0;
        right = -left0;
        top = -bottom0;
        bottom = -top0;
        break;
      case 270:
        left = -top0;
        right = -bottom0;
        top = right0;
        bottom = left0;
        break;
    }

    if (this.#flipHorizontal) {
      const temp = left;
      left = right;
      right = temp;
    }
    if (this.#flipVertical) {
      const temp = top;
      top = bottom;
      bottom = temp;
    }

    out.makePerspective(left, right, top, bottom, near, far);
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
    let { width: canvasWidth, height: canvasHeight } = this.#canvasSize;
    if (this.#rotation === 90 || this.#rotation === 270) {
      const width = canvasWidth;
      canvasWidth = canvasHeight;
      canvasHeight = width;
    }

    return Math.min(
      (canvasWidth / this.#model.width) * this.#aspectZoom.x,
      (canvasHeight / this.#model.height) * this.#aspectZoom.y,
    );
  }

  /**
   * Uses the camera model to compute the zoom factors to preserve the aspect ratio of the image.
   */
  #updateAspectZoom(): void {
    const model = this.#model;
    if (!model) {
      return;
    }
    // Adapted from https://github.com/ros2/rviz/blob/ee44ccde8a7049073fd1901dd36c1fb69110f726/rviz_default_plugins/src/rviz_default_plugins/displays/camera/camera_display.cpp#L568
    this.#aspectZoom.set(this.#userZoom, this.#userZoom);

    const { width: imgWidth, height: imgHeight } = model;

    const fx = model.P[0]!;
    const fy = model.P[5]!;
    let rendererAspect = this.#canvasSize.width / this.#canvasSize.height;
    const imageAspect = imgWidth / fx / (imgHeight / fy);

    if (this.#rotation === 90 || this.#rotation === 270) {
      rendererAspect = 1 / rendererAspect;
    }

    let adjustY = imageAspect > rendererAspect;
    if (this.#zoomMode === "fill") {
      adjustY = !adjustY;
    }
    if (adjustY) {
      this.#aspectZoom.y = (this.#aspectZoom.y / imageAspect) * rendererAspect;
    } else {
      this.#aspectZoom.x = (this.#aspectZoom.x / rendererAspect) * imageAspect;
    }
  }
}
