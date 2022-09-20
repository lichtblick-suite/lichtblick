// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { toNanoSec } from "@foxglove/rostime";
import { SceneEntity, SceneEntityDeletion, SceneEntityDeletionType } from "@foxglove/schemas";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { updatePose } from "../updatePose";
import { LayerSettingsEntity } from "./SceneEntities";
import { PrimitivePool } from "./primitives/PrimitivePool";
import { RenderableArrows } from "./primitives/RenderableArrows";
import { RenderableCubes } from "./primitives/RenderableCubes";
import { RenderableCylinders } from "./primitives/RenderableCylinders";
import { RenderableLines } from "./primitives/RenderableLines";
import { RenderableModels } from "./primitives/RenderableModels";
import { RenderableSpheres } from "./primitives/RenderableSpheres";
import { RenderableTexts } from "./primitives/RenderableTexts";
import { RenderableTriangles } from "./primitives/RenderableTriangles";
import { ALL_PRIMITIVE_TYPES, PrimitiveType } from "./primitives/types";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

const INVALID_DELETION_TYPE = "INVALID_DELETION_TYPE";

export type EntityTopicUserData = BaseUserData & {
  topic: string;
  settings: LayerSettingsEntity;
};

type EntityRenderables = {
  [PrimitiveType.CUBES]?: RenderableCubes;
  [PrimitiveType.MODELS]?: RenderableModels;
  [PrimitiveType.LINES]?: RenderableLines;
  [PrimitiveType.CYLINDERS]?: RenderableCylinders;
  [PrimitiveType.ARROWS]?: RenderableArrows;
  [PrimitiveType.SPHERES]?: RenderableSpheres;
  [PrimitiveType.TEXTS]?: RenderableTexts;
  [PrimitiveType.TRIANGLES]?: RenderableTriangles;
};

const PRIMITIVE_KEYS = {
  [PrimitiveType.CUBES]: "cubes",
  [PrimitiveType.MODELS]: "models",
  [PrimitiveType.LINES]: "lines",
  [PrimitiveType.CYLINDERS]: "cylinders",
  [PrimitiveType.ARROWS]: "arrows",
  [PrimitiveType.SPHERES]: "spheres",
  [PrimitiveType.TEXTS]: "texts",
  [PrimitiveType.TRIANGLES]: "triangles",
} as const;

export class TopicEntities extends Renderable<EntityTopicUserData> {
  public override pickable = false;
  private renderablesById = new Map<string, EntityRenderables>();

  public constructor(
    name: string,
    private primitivePool: PrimitivePool,
    renderer: Renderer,
    userData: EntityTopicUserData,
  ) {
    super(name, renderer, userData);
  }

  // eslint-disable-next-line no-restricted-syntax
  public get topic(): string {
    return this.userData.topic;
  }

  public override dispose(): void {
    this.children.length = 0;
    this._deleteAllEntities();
  }

  public updateSettings(): void {
    // Updates each individual primitive renderable using the current topic settings
    for (const renderables of this.renderablesById.values()) {
      for (const renderable of Object.values(renderables)) {
        renderable.updateSettings(this.userData.settings);
      }
    }
  }

  public setColorScheme(colorScheme: "dark" | "light"): void {
    for (const renderables of this.renderablesById.values()) {
      for (const renderable of Object.values(renderables)) {
        renderable.setColorScheme(colorScheme);
      }
    }
  }

  public startFrame(currentTime: bigint, renderFrameId: string, fixedFrameId: string): void {
    this.visible = this.userData.settings.visible;
    if (!this.visible) {
      this.renderer.settings.errors.clearTopic(this.topic);
      return;
    }

    for (const renderables of this.renderablesById.values()) {
      for (const renderable of Object.values(renderables)) {
        const entity = renderable.userData.entity;
        if (!entity) {
          continue;
        }

        // Check if this entity has expired
        const expiresAt = renderable.userData.expiresAt;
        if (expiresAt != undefined && currentTime > expiresAt) {
          this._deleteEntity(entity.id);
          break;
        }

        const frameId = this.renderer.normalizeFrameId(entity.frame_id);
        const srcTime = entity.frame_locked ? currentTime : toNanoSec(entity.timestamp);
        const updated = updatePose(
          renderable,
          this.renderer.transformTree,
          renderFrameId,
          fixedFrameId,
          frameId,
          currentTime,
          srcTime,
        );
        renderable.visible = updated;
        const topic = this.userData.topic;
        if (!updated) {
          const message = missingTransformMessage(renderFrameId, fixedFrameId, frameId);
          this.renderer.settings.errors.addToTopic(topic, MISSING_TRANSFORM, message);
        } else {
          this.renderer.settings.errors.removeFromTopic(topic, MISSING_TRANSFORM);
        }
      }
    }
  }

  public addOrUpdateEntity(entity: SceneEntity, receiveTime: bigint): void {
    let renderables = this.renderablesById.get(entity.id);
    if (!renderables) {
      renderables = {};
      this.renderablesById.set(entity.id, renderables);
    }

    for (const primitiveType of ALL_PRIMITIVE_TYPES) {
      const hasPrimitives = entity[PRIMITIVE_KEYS[primitiveType]].length > 0;
      let renderable = renderables[primitiveType];
      if (hasPrimitives) {
        if (!renderable) {
          renderable = this.primitivePool.acquire(primitiveType);
          renderable.name = `${entity.id}:${primitiveType} on ${this.topic}`;
          renderable.setColorScheme(this.renderer.colorScheme);
          // @ts-expect-error TS doesn't know that renderable matches primitiveType
          renderables[primitiveType] = renderable;
          this.add(renderable);
        }
        renderable.update(entity, this.userData.settings, receiveTime);
      } else if (renderable) {
        this.remove(renderable);
        delete renderables[primitiveType];
        this.primitivePool.release(primitiveType, renderable);
      }
    }
  }

  public deleteEntities(deletion: SceneEntityDeletion): void {
    switch (deletion.type) {
      case SceneEntityDeletionType.MATCHING_ID:
        this._deleteEntity(deletion.id);
        break;
      case SceneEntityDeletionType.ALL:
        this._deleteAllEntities();
        break;
      default:
        // Unknown action
        this.renderer.settings.errors.addToTopic(
          this.topic,
          INVALID_DELETION_TYPE,
          `Invalid deletion type ${deletion.type}`,
        );
    }
  }

  private _removeRenderables(renderables: EntityRenderables): void {
    for (const [primitiveType, primitive] of Object.entries(renderables) as [
      PrimitiveType,
      EntityRenderables[PrimitiveType],
    ][]) {
      if (primitive) {
        this.remove(primitive);
        this.primitivePool.release(primitiveType, primitive);
      }
    }
  }

  private _deleteEntity(id: string) {
    const renderables = this.renderablesById.get(id);
    if (renderables) {
      this._removeRenderables(renderables);
    }
    this.renderablesById.delete(id);
  }

  private _deleteAllEntities() {
    for (const renderables of this.renderablesById.values()) {
      this._removeRenderables(renderables);
    }
    this.renderablesById.clear();
  }
}
