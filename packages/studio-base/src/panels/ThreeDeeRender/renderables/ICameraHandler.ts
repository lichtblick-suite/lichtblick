// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import * as THREE from "three";

import { SceneExtension } from "@foxglove/studio-base/panels/ThreeDeeRender/SceneExtension";

import { CameraState } from "../camera";

export interface ICameraHandler extends SceneExtension {
  /**
   * Gets the active camera to use for rendering the scene
   * */
  getActiveCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera;
  /**
   * Sets the camera state
   * @param state - The new camera state
   */
  setCameraState(state: CameraState | undefined): void;
  /**
   * Gets the state of the camera if interface mode supports it, otherwise undefined
   */
  getCameraState(): CameraState | undefined;
  /**
   * Used to update the aspect ratio of the camera when necessary
   * @param width - The width of the render canvas in CSS pixels
   * @param height - The height of the render canvas in CSS pixels
   */
  handleResize(width: number, height: number): void;
}
