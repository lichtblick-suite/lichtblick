// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { RosValue } from "@foxglove/studio-base/players/types";

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
  /** Identifies this class as inheriting from `Renderable` */
  public readonly isRenderable = true;
  /** Allow this Renderable to be selected during picking and shown in the Object Details view */
  public readonly pickable: boolean = true;
  /**
   * Use a second picking pass for this Renderable to select a single numeric instanceId. This
   * instanceId can be passed to `instanceDetails()` to get more information about the instance.
   */
  public readonly pickableInstances: boolean = false;
  /** A reference to the parent `Renderer` that owns the scene graph containing this object */
  protected readonly renderer: Renderer;
  /** Additional data associated with this entity */
  public override userData: TUserData;

  public constructor(name: string, renderer: Renderer, userData: TUserData) {
    super();
    this.name = name;
    this.renderer = renderer;
    this.userData = userData;
  }

  /**
   * Dispose of any unmanaged resources uniquely associated with this Renderable
   * such as GPU buffers.
   */
  public dispose(): void {
    this.children.length = 0;
  }

  /**
   * Return a Plain Old JavaScript Object (POJO) representation of this Renderable
   */
  public details(): Record<string, RosValue> {
    return {};
  }

  /**
   * Return a Plain Old JavaScript Object (POJO) representation of a specific
   * visual instance rendered by this Renderable.
   * @param instanceId
   */
  public instanceDetails(instanceId: number): Record<string, RosValue> | undefined {
    void instanceId;
    return undefined;
  }
}
