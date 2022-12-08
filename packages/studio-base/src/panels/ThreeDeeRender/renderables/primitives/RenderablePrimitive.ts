// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SceneEntity } from "@foxglove/schemas";
import { BaseUserData, Renderable } from "@foxglove/studio-base/panels/ThreeDeeRender/Renderable";
import { LayerSettingsEntity } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/SceneEntities";
import { RosValue } from "@foxglove/studio-base/players/types";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

export type EntityRenderableUserData = BaseUserData & {
  topic?: string;
  entity?: SceneEntity;
  expiresAt?: bigint;
  settings?: LayerSettingsEntity;
};

export class RenderablePrimitive extends Renderable<EntityRenderableUserData> {
  public update(
    topic: string | undefined,
    entity: SceneEntity | undefined,
    settings: LayerSettingsEntity,
    receiveTime: bigint,
  ): void {
    this.userData.topic = topic;
    this.userData.entity = entity;
    this.userData.settings = settings;
    this.userData.receiveTime = receiveTime;
  }

  public override idFromMessage(): number | string | undefined {
    return this.userData.entity?.id;
  }

  public override selectedIdVariable(): string | undefined {
    if (this.userData.topic == undefined) {
      return undefined;
    }
    const settings = this.renderer.config.topics[this.userData.topic] as
      | LayerSettingsEntity
      | undefined;
    return settings?.selectedIdVariable;
  }

  public override details(): Record<string, RosValue> {
    return this.userData.entity ?? {};
  }

  public setColorScheme(colorScheme: "dark" | "light"): void {
    void colorScheme;
  }

  public prepareForReuse(): void {
    this.userData.entity = undefined;
    this.userData.pose = emptyPose();
  }

  public addError(errorId: string, message: string): void {
    this.renderer.settings.errors.add(this.userData.settingsPath, errorId, message);
  }

  public clearErrors(): void {
    // presumably a renderable has not been assigned a settings path if it is 0
    // running clearPath([]) will clear all errors from the settings tree
    if (this.userData.settingsPath.length > 0) {
      this.renderer.settings.errors.clearPath(this.userData.settingsPath);
    }
  }
}
