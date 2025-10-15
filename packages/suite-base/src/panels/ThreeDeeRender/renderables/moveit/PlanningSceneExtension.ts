// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { toNanoSec } from "@lichtblick/rostime";
import { SettingsTreeAction } from "@lichtblick/suite";
import { PlanningScene } from "@lichtblick/suite-base/types/MoveItMessages";

import type { IRenderer, AnyRendererSubscription } from "../../IRenderer";
import { SceneExtension, PartialMessageEvent } from "../../SceneExtension";
import { RenderablePlanningScene } from "./RenderablePlanningScene";
import { SettingsTreeEntry } from "../../SettingsManager";
import { topicIsConvertibleToSchema } from "../../topicIsConvertibleToSchema";

// Schema types for PlanningScene messages
const PLANNING_SCENE_DATATYPES = new Set([
  "moveit_msgs/PlanningScene",
  "moveit_msgs/msg/PlanningScene", // ROS2 format
  "ros.moveit_msgs.PlanningScene", // protobuf format
]);

export type TopicPlanningScene = {
  topic: string;
  planningScene: RenderablePlanningScene | undefined;
  receiveTime: bigint | undefined;
};

export class PlanningSceneExtension extends SceneExtension<RenderablePlanningScene> {
  public static extensionId = "foxglove.PlanningScene";
  #topics = new Map<string, TopicPlanningScene>();

  public constructor(renderer: IRenderer) {
    super("foxglove.PlanningScene", renderer);

    renderer.on("transformTreeUpdated", this.#handleTransformTreeUpdated);
    renderer.on("topicsChanged", this.#handleTopicsChanged);
  }

  public override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.#handleTransformTreeUpdated);
    this.renderer.off("topicsChanged", this.#handleTopicsChanged);

    // Clean up renderables
    for (const renderable of this.renderables.values()) {
      renderable.dispose();
    }
    this.renderables.clear();
    this.#topics.clear();

    super.dispose();
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    return this.#buildSettingsTree();
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    // Path should be ["topics", topicName, fieldName]
    if (path[0] !== "topics") {
      return;
    }

    const topicName = path[1];
    const fieldName = path[2];
    if (!topicName || !fieldName) {
      return;
    }

    // Save the setting using the base class method
    this.saveSetting(path, action.payload.value);

    // Update the renderable if it exists
    const topic = this.#topics.get(topicName);
    if (topic?.planningScene) {
      // Handle visibility changes
      if (fieldName === "visible") {
        topic.planningScene.visible = action.payload.value as boolean;
      }
      // Update the renderable with current data
      topic.planningScene.update(topic.planningScene.userData.planningScene, topic.receiveTime);
    }
  };


  #buildSettingsTree(): SettingsTreeEntry[] {
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];

    // Check all available topics for PlanningScene messages
    for (const topic of this.renderer.topics ?? []) {
      if (topicIsConvertibleToSchema(topic, PLANNING_SCENE_DATATYPES)) {
        const config = this.renderer.config.topics[topic.name] as Partial<LayerSettingsPlanningScene>;

        entries.push({
          path: ["topics", topic.name],
          node: {
            label: topic.name,
            icon: "Cube",
            order: topic.name.toLocaleLowerCase(),
            visible: config?.visible ?? DEFAULT_SETTINGS.visible,
            handler,
            fields: {
              showCollisionObjects: {
                label: "Show Collision Objects",
                input: "boolean",
                value: config?.showCollisionObjects ?? DEFAULT_SETTINGS.showCollisionObjects,
              },
              collisionObjectColor: {
                label: "Collision Object Color",
                input: "rgba",
                value: config?.collisionObjectColor ?? DEFAULT_SETTINGS.collisionObjectColor,
              },
            },
          },
        });
      }
    }

    return entries;
  }

  #handleTransformTreeUpdated = (): void => {
    this.updateSettingsTree();
  };

  #handleTopicsChanged = (): void => {
    this.updateSettingsTree();
  };

  #handlePlanningScene = (messageEvent: PartialMessageEvent<unknown>): void => {
    const topic = messageEvent.topic;
    const planningScene = messageEvent.message as Partial<PlanningScene>;
    const receiveTime = toNanoSec(messageEvent.receiveTime);


    // Only process if we have the required fields
    if (!planningScene.name || !planningScene.robot_state?.joint_state?.header) {
      return;
    }

    let topicPlanningScene = this.#topics.get(topic);
    if (!topicPlanningScene) {
      topicPlanningScene = {
        topic,
        planningScene: undefined,
        receiveTime: undefined,
      };
      this.#topics.set(topic, topicPlanningScene);
    }

    topicPlanningScene.receiveTime = receiveTime;

    if (topicPlanningScene.planningScene) {
      topicPlanningScene.planningScene.update(planningScene as PlanningScene, receiveTime);
    } else {
      topicPlanningScene.planningScene = new RenderablePlanningScene(
        topic,
        planningScene as PlanningScene,
        receiveTime,
        this.renderer,
      );
      this.add(topicPlanningScene.planningScene);
      this.renderables.set(topic, topicPlanningScene.planningScene);
    }

    this.updateSettingsTree();
  };

  public override getSubscriptions(): readonly AnyRendererSubscription[] {
    return [
      {
        type: "schema",
        schemaNames: PLANNING_SCENE_DATATYPES,
        subscription: { handler: this.#handlePlanningScene },
      },
    ];
  }
}

// Settings for PlanningScene visualization
export type LayerSettingsPlanningScene = {
  visible: boolean;
  showCollisionObjects: boolean;
  collisionObjectColor: string;
};

const DEFAULT_SETTINGS: LayerSettingsPlanningScene = {
  visible: true,
  showCollisionObjects: true,
  collisionObjectColor: "#ff0000",
};
