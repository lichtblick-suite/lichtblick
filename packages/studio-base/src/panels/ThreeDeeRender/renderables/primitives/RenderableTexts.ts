// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { toNanoSec } from "@foxglove/rostime";
import { SceneEntity, TextPrimitive } from "@foxglove/schemas/schemas/typescript";
import { emptyPose } from "@foxglove/studio-base/util/Pose";
import { Label, LabelPool } from "@foxglove/three-text";

import type { Renderer } from "../../Renderer";
import { getLuminance, makeRgba, SRGBToLinear, stringToRgba } from "../../color";
import { LayerSettingsEntity } from "../SceneEntities";
import { RenderablePrimitive } from "./RenderablePrimitive";

const tempRgba = makeRgba();

export class RenderableTexts extends RenderablePrimitive {
  private labelPool: LabelPool;
  private labels: Label[] = [];

  public constructor(renderer: Renderer) {
    super("", renderer, {
      receiveTime: -1n,
      messageTime: -1n,
      frameId: "",
      pose: emptyPose(),
      settings: { visible: true, color: undefined },
      settingsPath: [],
      entity: undefined,
    });

    this.labelPool = renderer.labelPool;
  }
  private _ensureCapacity(newLength: number): void {
    const oldLength = this.labels.length;
    if (newLength > oldLength) {
      for (let i = oldLength; i < newLength; i++) {
        const newLabel = this.labelPool.acquire();
        this.labels.push(newLabel);
        this.add(newLabel);
      }
    }
  }

  private _updateTexts(texts: TextPrimitive[]) {
    this._ensureCapacity(texts.length);
    const overrideColor = this.userData.settings.color
      ? stringToRgba(tempRgba, this.userData.settings.color)
      : undefined;

    let i = 0;
    for (const text of texts) {
      const color = overrideColor ?? text.color;
      const label = this.labels[i];

      if (!label) {
        throw new Error("invariant: labels array smaller than requested");
      }

      label.setText(text.text);
      label.setColor(SRGBToLinear(color.r), SRGBToLinear(color.g), SRGBToLinear(color.b));

      const foregroundIsDark = getLuminance(color.r, color.g, color.b) < 0.5;
      if (foregroundIsDark) {
        label.setBackgroundColor(1, 1, 1);
      } else {
        label.setBackgroundColor(0, 0, 0);
      }
      label.setOpacity(color.a);
      label.setLineHeight(text.font_size);
      // note that billboard needs to be true for scale_invariant to work
      label.setBillboard(text.billboard);
      // attenuation -> size accounts for distance from camera
      // scale_invariant negates this and should make it the same size always
      label.setSizeAttenuation(!text.scale_invariant);
      label.quaternion.set(
        text.pose.orientation.x,
        text.pose.orientation.y,
        text.pose.orientation.z,
        text.pose.orientation.w,
      );

      label.position.set(text.pose.position.x, text.pose.position.y, text.pose.position.z);
      i++;
    }
    // need to release the no longer used labels so that they don't linger on the scene
    if (i < this.labels.length) {
      // cuts off remaining labels and loops through  them  release to from labelpool
      for (const label of this.labels.splice(i)) {
        this.labelPool.release(label);
      }
    }
  }

  public override dispose(): void {
    for (const label of this.labels) {
      this.labelPool.release(label);
    }
  }

  public override update(
    entity: SceneEntity | undefined,
    settings: LayerSettingsEntity,
    receiveTime: bigint,
  ): void {
    this.userData.entity = entity;
    this.userData.settings = settings;
    this.userData.receiveTime = receiveTime;
    if (entity) {
      const lifetimeNs = toNanoSec(entity.lifetime);
      this.userData.expiresAt = lifetimeNs === 0n ? undefined : receiveTime + lifetimeNs;
      this._updateTexts(entity.texts);
    }
  }

  public updateSettings(settings: LayerSettingsEntity): void {
    this.update(this.userData.entity, settings, this.userData.receiveTime);
  }
}
