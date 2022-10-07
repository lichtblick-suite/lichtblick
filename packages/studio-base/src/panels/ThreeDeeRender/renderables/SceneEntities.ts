// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { toNanoSec } from "@foxglove/rostime";
import {
  ArrowPrimitive,
  CubePrimitive,
  CylinderPrimitive,
  LinePrimitive,
  LineType,
  ModelPrimitive,
  SceneEntity,
  SceneEntityDeletion,
  SceneEntityDeletionType,
  SceneUpdate,
  SpherePrimitive,
  TextPrimitive,
  TriangleListPrimitive,
} from "@foxglove/schemas";
import { SettingsTreeAction } from "@foxglove/studio";

import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry, SettingsTreeNodeWithActionHandler } from "../SettingsManager";
import { SCENE_UPDATE_DATATYPES } from "../foxglove";
import {
  normalizeColorRGBA,
  normalizeColorRGBAs,
  normalizePose,
  normalizeTime,
  normalizeVector3,
  normalizeByteArray,
} from "../normalizeMessages";
import { BaseSettings } from "../settings";
import { makePose } from "../transforms";
import { TopicEntities } from "./TopicEntities";
import { PrimitivePool } from "./primitives/PrimitivePool";

export type LayerSettingsEntity = BaseSettings & {
  color: string | undefined;
};

const DEFAULT_SETTINGS: LayerSettingsEntity = {
  visible: false,
  color: undefined,
};

export class FoxgloveSceneEntities extends SceneExtension<TopicEntities> {
  private primitivePool = new PrimitivePool(this.renderer);

  public constructor(renderer: Renderer) {
    super("foxglove.SceneEntities", renderer);

    renderer.addDatatypeSubscriptions(SCENE_UPDATE_DATATYPES, this.handleSceneUpdate);
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (SCENE_UPDATE_DATATYPES.has(topic.schemaName)) {
        const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsEntity>;

        const node: SettingsTreeNodeWithActionHandler = {
          label: topic.name,
          icon: "Shapes",
          order: topic.name.toLocaleLowerCase(),
          fields: {
            color: { label: "Color", input: "rgba", value: config.color },
          },
          visible: config.visible ?? DEFAULT_SETTINGS.visible,
          handler: this.handleSettingsAction,
        };

        entries.push({ path: ["topics", topic.name], node });
      }
    }
    return entries;
  }

  public override startFrame(
    currentTime: bigint,
    renderFrameId: string,
    fixedFrameId: string,
  ): void {
    // Don't use SceneExtension#startFrame() because our renderables represent one topic each with
    // many entities. Instead, call startFrame on each renderable
    for (const renderable of this.renderables.values()) {
      renderable.startFrame(currentTime, renderFrameId, fixedFrameId);
    }
  }

  public override setColorScheme(
    colorScheme: "dark" | "light",
    _backgroundColor: THREE.Color | undefined,
  ): void {
    for (const renderable of this.renderables.values()) {
      renderable.setColorScheme(colorScheme);
    }
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    this.saveSetting(path, action.payload.value);

    // Update the TopicEntities settings
    const topicName = path[1]!;
    const renderable = this.renderables.get(topicName);
    if (renderable) {
      const settings = this.renderer.config.topics[topicName] as
        | Partial<LayerSettingsEntity>
        | undefined;
      renderable.userData.settings = { ...DEFAULT_SETTINGS, ...settings };
      renderable.updateSettings();
    }
  };

  private handleSceneUpdate = (messageEvent: PartialMessageEvent<SceneUpdate>): void => {
    const topic = messageEvent.topic;
    const sceneUpdates = messageEvent.message;

    for (const entityMsg of sceneUpdates.entities ?? []) {
      const entity = normalizeSceneEntity(entityMsg);
      this._getTopicEntities(topic).addOrUpdateEntity(entity, toNanoSec(messageEvent.receiveTime));
    }

    for (const deletionMsg of sceneUpdates.deletions ?? []) {
      const deletion = normalizeSceneEntityDeletion(deletionMsg);
      this._getTopicEntities(topic).deleteEntities(deletion);
    }
  };

  private _getTopicEntities(topic: string): TopicEntities {
    let topicEntities = this.renderables.get(topic);
    if (!topicEntities) {
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsEntity>
        | undefined;

      topicEntities = new TopicEntities(topic, this.primitivePool, this.renderer, {
        receiveTime: -1n,
        messageTime: -1n,
        frameId: "",
        pose: makePose(),
        settingsPath: ["topics", topic],
        topic,
        settings: { ...DEFAULT_SETTINGS, ...userSettings },
      });
      this.renderables.set(topic, topicEntities);
      this.add(topicEntities);
    }
    return topicEntities;
  }

  public override dispose(): void {
    super.dispose();
    this.primitivePool.dispose();
  }
}

function normalizeSceneEntity(entity: PartialMessage<SceneEntity>): SceneEntity {
  return {
    timestamp: normalizeTime(entity.timestamp),
    frame_id: entity.frame_id ?? "",
    id: entity.id ?? "",
    lifetime: normalizeTime(entity.lifetime),
    frame_locked: entity.frame_locked ?? false,
    metadata:
      entity.metadata?.map(({ key, value }) => ({ key: key ?? "", value: value ?? "" })) ?? [],
    arrows: entity.arrows?.map(normalizeArrowPrimitive) ?? [],
    cubes: entity.cubes?.map(normalizeCubePrimitive) ?? [],
    spheres: entity.spheres?.map(normalizeSpherePrimitive) ?? [],
    cylinders: entity.cylinders?.map(normalizeCylinderPrimitive) ?? [],
    lines: entity.lines?.map(normalizeLinePrimitive) ?? [],
    triangles: entity.triangles?.map(normalizeTriangleListPrimitive) ?? [],
    texts: entity.texts?.map(normalizeTextPrimitive) ?? [],
    models: entity.models?.map(normalizeModelPrimitive) ?? [],
  };
}

function normalizeSceneEntityDeletion(
  entity: PartialMessage<SceneEntityDeletion>,
): SceneEntityDeletion {
  return {
    timestamp: normalizeTime(entity.timestamp),
    type: entity.type ?? SceneEntityDeletionType.MATCHING_ID,
    id: entity.id ?? "",
  };
}

function normalizeArrowPrimitive(arrow: PartialMessage<ArrowPrimitive>): ArrowPrimitive {
  return {
    pose: normalizePose(arrow.pose),
    shaft_length: arrow.shaft_length ?? 0.8,
    shaft_diameter: arrow.shaft_diameter ?? 0.1,
    head_length: arrow.head_length ?? 0.2,
    head_diameter: arrow.head_diameter ?? 0.2,
    color: normalizeColorRGBA(arrow.color),
  };
}

function normalizeCubePrimitive(cube: PartialMessage<CubePrimitive>): CubePrimitive {
  return {
    pose: normalizePose(cube.pose),
    size: normalizeVector3(cube.size),
    color: normalizeColorRGBA(cube.color),
  };
}

function normalizeSpherePrimitive(sphere: PartialMessage<SpherePrimitive>): SpherePrimitive {
  return {
    pose: normalizePose(sphere.pose),
    size: normalizeVector3(sphere.size),
    color: normalizeColorRGBA(sphere.color),
  };
}

function normalizeCylinderPrimitive(
  cylinder: PartialMessage<CylinderPrimitive>,
): CylinderPrimitive {
  return {
    pose: normalizePose(cylinder.pose),
    size: normalizeVector3(cylinder.size),
    bottom_scale: cylinder.bottom_scale ?? 1,
    top_scale: cylinder.top_scale ?? 1,
    color: normalizeColorRGBA(cylinder.color),
  };
}

function normalizeLinePrimitive(line: PartialMessage<LinePrimitive>): LinePrimitive {
  return {
    type: line.type ?? LineType.LINE_STRIP,
    pose: normalizePose(line.pose),
    thickness: line.thickness ?? 0.05,
    scale_invariant: line.scale_invariant ?? false,
    points: line.points?.map(normalizeVector3) ?? [],
    color: normalizeColorRGBA(line.color),
    colors: normalizeColorRGBAs(line.colors),
    indices: line.indices ?? [],
  };
}

function normalizeTriangleListPrimitive(
  triangles: PartialMessage<TriangleListPrimitive>,
): TriangleListPrimitive {
  return {
    pose: normalizePose(triangles.pose),
    points: triangles.points?.map(normalizeVector3) ?? [],
    color: normalizeColorRGBA(triangles.color),
    colors: normalizeColorRGBAs(triangles.colors),
    indices: triangles.indices ?? [],
  };
}

function normalizeTextPrimitive(text: PartialMessage<TextPrimitive>): TextPrimitive {
  return {
    pose: normalizePose(text.pose),
    billboard: text.billboard ?? true,
    font_size: text.font_size ?? (text.scale_invariant ?? false ? 16 : 0.25),
    scale_invariant: text.scale_invariant ?? false,
    color: normalizeColorRGBA(text.color),
    text: text.text ?? "",
  };
}

function normalizeModelPrimitive(model: PartialMessage<ModelPrimitive>): ModelPrimitive {
  return {
    pose: normalizePose(model.pose),
    scale: normalizeVector3(model.scale),
    color: normalizeColorRGBA(model.color),
    override_color: model.override_color ?? false,
    url: model.url ?? "",
    media_type: model.media_type ?? "",
    data: normalizeByteArray(model.data),
  };
}
