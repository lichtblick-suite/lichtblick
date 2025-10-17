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
import { BaseSettings } from "../../settings";
import { SettingsTreeEntry } from "../../SettingsManager";
import { topicIsConvertibleToSchema } from "../../topicIsConvertibleToSchema";

export type LayerSettingsPlanningScene = BaseSettings & {
  showCollisionObjects: boolean;
  collisionObjectColor: string;
};

const DEFAULT_SETTINGS: LayerSettingsPlanningScene = {
  visible: true,
  frameLocked: false,
  showCollisionObjects: true,
  collisionObjectColor: "#ff0000",
};

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

    // Add debug logging
    console.log("🔧 PlanningSceneExtension: Constructor called");
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

  #handleTransformTreeUpdated = (): void => {
    console.log("🔧 PlanningSceneExtension: Transform tree updated");
    // Transform tree updates are handled automatically by the renderer
  };

  #handleTopicsChanged = (): void => {
    console.log("🔧 PlanningSceneExtension: Topics changed");
    this.updateSettingsTree();
  };

  #handlePlanningScene = (messageEvent: PartialMessageEvent<unknown>): void => {
    const topic = messageEvent.topic;
    const planningScene = messageEvent.message as Partial<PlanningScene>;
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    console.log(`🔧 PlanningSceneExtension: Received message on topic: ${topic}`);
    console.log(`🔧 Message keys:`, Object.keys(planningScene));
    console.log(`🔧 Collision objects count: ${planningScene.world?.collision_objects?.length ?? 0}`);
    console.log(`🔧 Is diff: ${planningScene.is_diff}`);
    console.log(`🔧 Robot state exists: ${!!planningScene.robot_state?.joint_state?.header}`);

    // Only process if we have the required fields
    if (!planningScene.name || !planningScene.robot_state?.joint_state?.header) {
      console.log(`❌ PlanningSceneExtension: Missing required fields - name: ${!!planningScene.name}, robot_state: ${!!planningScene.robot_state?.joint_state?.header}`);
      return;
    }

    console.log(`✅ PlanningSceneExtension: Processing valid message for topic: ${topic}`);

    let topicPlanningScene = this.#topics.get(topic);
    if (!topicPlanningScene) {
      topicPlanningScene = { topic, receiveTime: 0n, planningScene: undefined };
      this.#topics.set(topic, topicPlanningScene);
    }
    topicPlanningScene.receiveTime = receiveTime;

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      console.log(`🔧 PlanningSceneExtension: Creating new renderable for topic: ${topic}`);
      // Cast to full PlanningScene since we've validated required fields exist
      renderable = new RenderablePlanningScene(topic, planningScene as PlanningScene, receiveTime, this.renderer);
      this.add(renderable);
      this.renderables.set(topic, renderable);
      console.log(`🔧 PlanningSceneExtension: Renderable created and added to scene`);
    } else {
      console.log(`🔧 PlanningSceneExtension: Updating existing renderable for topic: ${topic}`);
      renderable.update(planningScene as PlanningScene, receiveTime);
    }
  };

  public override getSubscriptions(): readonly AnyRendererSubscription[] {
    return [
      {
        type: "schema",
        schemaNames: PLANNING_SCENE_DATATYPES,
        subscription: { handler: this.#handlePlanningScene },
      },
    ];
  };

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    console.log(`🔧 PlanningSceneExtension: Settings action received:`, action);
    console.log(`🔧 PlanningSceneExtension: Path:`, path);

    if (action.action !== "update" || path.length !== 3) {
      console.log(`🔧 PlanningSceneExtension: Invalid action or path length`);
      return;
    }

    // Path should be ["topics", topicName, fieldName]
    if (path[0] !== "topics") {
      console.log(`🔧 PlanningSceneExtension: Path doesn't start with 'topics'`);
      return;
    }

    const topicName = path[1];
    const fieldName = path[2];
    if (!topicName || !fieldName) {
      console.log(`🔧 PlanningSceneExtension: Missing topic name or field name`);
      return;
    }

    console.log(`🔧 PlanningSceneExtension: Updating ${fieldName} for topic ${topicName} to:`, action.payload.value);

    // Save the setting using the base class method
    this.saveSetting(path, action.payload.value);

    // Update the renderable if it exists
    const renderable = this.renderables.get(topicName);
    if (renderable) {
      console.log(`🔧 PlanningSceneExtension: Found renderable for topic ${topicName}, updating...`);

      // Handle visibility changes
      if (fieldName === "visible") {
        console.log(`🔧 PlanningSceneExtension: Setting visibility to:`, action.payload.value);

        // If turning off, force clear all objects first
        if (action.payload.value === false) {
          console.log(`🔧 PlanningSceneExtension: Topic being turned OFF - force clearing all objects`);
          renderable.forceClearAllObjects();
        }

        // Force update the renderable's visibility (this will handle the state change detection)
        renderable.updateVisibility();
      }

      // Handle other field changes
      if (fieldName === "showCollisionObjects" || fieldName === "collisionObjectColor") {
        console.log(`🔧 PlanningSceneExtension: Updating collision object settings...`);
        // Update the renderable with current data to refresh the visualization
        renderable.update(renderable.userData.planningScene, renderable.userData.receiveTime);
      }
    } else {
      console.log(`🔧 PlanningSceneExtension: No renderable found for topic ${topicName}`);
    }

    // Update the settings tree to reflect changes
    this.updateSettingsTree();
  };


  #buildSettingsTree(): SettingsTreeEntry[] {
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];

    console.log("🔧 PlanningSceneExtension: Building settings tree");
    console.log("🔧 Available topics:", this.renderer.topics?.map(t => ({ name: t.name, schemaName: t.schemaName, convertibleTo: t.convertibleTo })));
    console.log("🔧 Looking for schemas:", Array.from(PLANNING_SCENE_DATATYPES));

    // Check all available topics for PlanningScene messages
    for (const topic of this.renderer.topics ?? []) {
      console.log(`🔧 Checking topic: ${topic.name} with schema: ${topic.schemaName}`);
      console.log(`🔧 Topic convertibleTo:`, topic.convertibleTo);

      const isConvertible = topicIsConvertibleToSchema(topic, PLANNING_SCENE_DATATYPES);
      console.log(`🔧 Topic ${topic.name} is convertible: ${isConvertible}`);

      if (isConvertible) {
        console.log(`✅ Found matching topic: ${topic.name}`);
        const config = this.renderer.config.topics[topic.name] as Partial<LayerSettingsPlanningScene>;

        // Read visibility from current config, not force it
        const visible = config?.visible ?? DEFAULT_SETTINGS.visible;
        console.log(`🔧 Topic ${topic.name} visibility from config: ${visible}`);

        entries.push({
          path: ["topics", topic.name],
          node: {
            label: topic.name,
            icon: "Cube",
            order: topic.name.toLocaleLowerCase(),
            visible: visible, // Use actual config value
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

    console.log(`🔧 PlanningSceneExtension: Found ${entries.length} matching topics`);
    return entries;
  }
}
