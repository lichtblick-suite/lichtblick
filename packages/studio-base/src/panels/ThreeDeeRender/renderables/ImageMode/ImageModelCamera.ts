// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { PinholeCameraModel } from "@foxglove/den/image";

const DEFAULT_CAMERA_STATE = {
  near: 0.001,
  far: 1000,
};

export class ImageModelCamera extends THREE.PerspectiveCamera {
  private model?: PinholeCameraModel;
  private cameraState = DEFAULT_CAMERA_STATE;

  /** x/y zoom factors derived from image and window aspect ratios */
  private aspectZoom = new THREE.Vector2();
  private rendererAspect = 1;

  public updateCamera(cameraModel: PinholeCameraModel): void {
    this.model = cameraModel;
    this.updateProjection();
  }

  private updateProjection(): void {
    this.updateAspectScaledZoom();

    const projection = this.getProjection();

    if (projection) {
      this.projectionMatrix.copy(projection);
      this.projectionMatrixInverse.copy(projection).invert();
    }
  }

  /**
   * Get Perspective projection matrix from this.cameraModel.model
   * @returns the projection matrix for the current camera model, or undefined if no camera model is available
   */
  private getProjection(): THREE.Matrix4 | undefined {
    const model = this.model;
    if (!model?.P) {
      return;
    }

    // Adapted from https://github.com/ros2/rviz/blob/ee44ccde8a7049073fd1901dd36c1fb69110f726/rviz_default_plugins/src/rviz_default_plugins/displays/camera/camera_display.cpp#L615
    // focal lengths
    const fx = model.P[0];
    const fy = model.P[5];
    // (cx, cy) image center in pixel coordinates
    // for panning we can take offsets from this in pixel coordinates
    const cx = model.P[2];
    const cy = model.P[6];
    const { width, height } = model;

    const zoom = this.aspectZoom;
    const zoomX = zoom.x;
    const zoomY = zoom.y;
    const near = this.cameraState.near;
    const far = this.cameraState.far;

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

  public setRendererAspect(aspect: number): void {
    this.rendererAspect = aspect;
    this.updateProjection();
  }

  /**
   * Uses the camera model to compute the zoom factors to preserve the aspect ratio of the image.
   */
  private updateAspectScaledZoom(): void {
    const model = this.model;
    if (!model?.P) {
      return;
    }
    // Adapted from https://github.com/ros2/rviz/blob/ee44ccde8a7049073fd1901dd36c1fb69110f726/rviz_default_plugins/src/rviz_default_plugins/displays/camera/camera_display.cpp#L568
    this.aspectZoom.set(1.0, 1.0);

    const { width: imgWidth, height: imgHeight } = model;

    const fx = model.P[0]!;
    const fy = model.P[5]!;
    const rendererAspect = this.rendererAspect;
    const imageAspect = imgWidth / fx / (imgHeight / fy);
    // preserve the aspect ratio
    if (imageAspect > rendererAspect) {
      this.aspectZoom.y = (this.aspectZoom.y / imageAspect) * rendererAspect;
    } else {
      this.aspectZoom.x = (this.aspectZoom.x / rendererAspect) * imageAspect;
    }
  }
}
