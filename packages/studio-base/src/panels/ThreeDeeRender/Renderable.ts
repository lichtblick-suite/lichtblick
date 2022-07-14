// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { Renderer } from "./Renderer";
import type { BaseSettings } from "./settings";
import type { Pose } from "./transforms";

export type BaseUserData = {
  /** Timestamp when the associated `MessageEvent` was received */
  receiveTime: bigint;
  /** Timestamp extracted from a field in the associated message, such as `header.stamp` */
  messageTime: bigint;
  /** Coordinate frame this Renderable exists in */
  frameId: string;
  /** Local position and orientation of the Renderable */
  pose: Pose;
  /** Settings tree path where errors will be displayed */
  settingsPath: ReadonlyArray<string>;
  /** User-customizable settings for this Renderable */
  settings: BaseSettings;
};

/**
 * Renderables are generic THREE.js scene graph entities with additional
 * properties from `BaseUserData` that allow coordinate frame transforms to
 * automatically be applied and settings tree errors to be displayed.
 */
export class Renderable<TUserData extends BaseUserData = BaseUserData> extends THREE.Object3D {
  readonly isRenderable = true;
  readonly renderer: Renderer;
  override userData: TUserData;

  constructor(name: string, renderer: Renderer, userData: TUserData) {
    super();
    this.name = name;
    this.renderer = renderer;
    this.userData = userData;
  }

  /**
   * Dispose of any unmanaged resources uniquely associated with this Renderable
   * such as GPU buffers.
   */
  dispose(): void {
    this.children.length = 0;
  }
}
