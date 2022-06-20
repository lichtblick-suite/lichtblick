// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { Renderer } from "./Renderer";
import type { BaseSettings } from "./settings";
import type { Pose } from "./transforms";

export type BaseUserData = {
  receiveTime: bigint;
  messageTime: bigint;
  frameId: string;
  pose: Pose;
  settingsPath: ReadonlyArray<string>;
  settings: BaseSettings;
};

export class Renderable<TUserData extends BaseUserData> extends THREE.Object3D {
  readonly isRenderable = true;
  readonly renderer: Renderer;
  override userData: TUserData;

  constructor(name: string, renderer: Renderer, userData: TUserData) {
    super();
    this.name = name;
    this.renderer = renderer;
    this.userData = userData;
  }

  dispose(): void {
    this.children.length = 0;
  }
}
