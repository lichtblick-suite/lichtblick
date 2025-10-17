// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@lichtblick/rostime";
import { RosValue } from "@lichtblick/suite-base/players/types";
import { PlanningScene, CollisionObject } from "@lichtblick/suite-base/types/MoveItMessages";

import type { IRenderer } from "../../IRenderer";
import { BaseUserData, Renderable } from "../../Renderable";
import type { LayerSettingsPlanningScene } from "./PlanningSceneExtension";

export type PlanningSceneUserData = BaseUserData & {
  topic: string;
  planningScene: PlanningScene;
  originalPlanningScene: PlanningScene;
  collisionObjects: THREE.Group;
};

export class RenderablePlanningScene extends Renderable<PlanningSceneUserData> {
  #collisionObjects: THREE.Group;
  #markers: Map<string, THREE.Object3D> = new Map();
  #persistentCollisionObjects: Map<string, CollisionObject> = new Map();

  public constructor(
    topic: string,
    planningScene: PlanningScene,
    receiveTime: bigint | undefined,
    renderer: IRenderer,
  ) {
    const name = `planning-scene-${topic}`;

    super(name, renderer, {
      receiveTime: receiveTime ?? 0n,
      messageTime: toNanoSec(planningScene.robot_state.joint_state.header.stamp),
      frameId: renderer.normalizeFrameId(planningScene.robot_state.joint_state.header.frame_id),
      pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      settingsPath: ["topics", topic],
      settings: { visible: true, frameLocked: false },
      topic,
      planningScene,
      originalPlanningScene: planningScene,
      collisionObjects: new THREE.Group(),
    });

    this.#collisionObjects = new THREE.Group();
    this.#collisionObjects.name = "collision-objects";
    this.add(this.#collisionObjects);

    console.log(`PlanningScene: Created renderable in frame: ${this.userData.frameId}`);
    console.log(`PlanningScene: Planning scene frame from robot state: ${planningScene.robot_state.joint_state.header.frame_id}`);
    console.log(`PlanningScene: Robot model frame: ${this.userData.frameId}`);
    console.log(`PlanningScene: Fixed frame: ${this.renderer.fixedFrameId}`);

    // Verify this matches getRobotModel()->getModelFrame() from RViz2

    this.update(planningScene, receiveTime);
  }

  public override idFromMessage(): string | undefined {
    return this.userData.planningScene.name;
  }

  public override details(): Record<string, RosValue> {
    return this.userData.originalPlanningScene;
  }

  public getSettings(): LayerSettingsPlanningScene | undefined {
    return this.renderer.config.topics[this.userData.topic] as LayerSettingsPlanningScene | undefined;
  }

  public update(planningScene: PlanningScene, receiveTime: bigint | undefined): void {
    if (receiveTime != undefined) {
      this.userData.receiveTime = receiveTime;
    }
    this.userData.messageTime = toNanoSec(planningScene.robot_state.joint_state.header.stamp);
    this.userData.frameId = this.renderer.normalizeFrameId(planningScene.robot_state.joint_state.header.frame_id);
    this.userData.planningScene = planningScene;
    this.userData.originalPlanningScene = planningScene;

    // DON'T call #updateScenePosition() here - it's too infrequent
    // Scene positioning is now handled in frameUpdate() for continuous updates

    this.#updateCollisionObjects(planningScene.world.collision_objects);
    this.#updateVisibility();
  }

  // REMOVED: Manual transform logic - Lichtblick handles this automatically via updatePose()
  // The SceneExtension.startFrame() method calls updatePose() for every renderable every frame
  // This automatically transforms from userData.frameId to renderFrameId via fixedFrameId

  public updateVisibility(): void {
    console.log(`🔧 RenderablePlanningScene: updateVisibility called`);
    this.#updateVisibility();
  }

  public forceClearAllObjects(): void {
    console.log(`🧹 FORCE CLEAR - Clearing all collision objects and persistent state for topic: ${this.userData.topic}`);
    this.#clearAllCollisionObjects();
    this.#persistentCollisionObjects.clear();
    console.log(`🧹 FORCE CLEAR COMPLETE - Markers: ${this.#markers.size}, Persistent: ${this.#persistentCollisionObjects.size}, Children: ${this.#collisionObjects.children.length}`);
  }

  #updateVisibility(): void {
    const settings = this.getSettings();
    const wasVisible = this.visible;
    const newVisible = settings?.visible ?? true;

    console.log(`🔍 VISIBILITY DEBUG:`);
    console.log(`🔍 Topic: ${this.userData.topic}`);
    console.log(`🔍 Was visible: ${wasVisible}`);
    console.log(`🔍 New visibility setting: ${newVisible}`);
    console.log(`🔍 Settings visible: ${settings?.visible}`);
    console.log(`🔍 Collision objects group children count: ${this.#collisionObjects.children.length}`);
    console.log(`🔍 Markers count: ${this.#markers.size}`);
    console.log(`🔍 Persistent objects count: ${this.#persistentCollisionObjects.size}`);

    // If topic was just disabled, clear all collision objects and persistent state
    if (wasVisible && !newVisible) {
      console.log(`🗑️ TOPIC DISABLED - Clearing all collision objects for topic: ${this.userData.topic}`);
      console.log(`🗑️ Before clear - Markers: ${this.#markers.size}, Persistent: ${this.#persistentCollisionObjects.size}, Children: ${this.#collisionObjects.children.length}`);

      this.#clearAllCollisionObjects();
      this.#persistentCollisionObjects.clear();

      console.log(`🗑️ After clear - Markers: ${this.#markers.size}, Persistent: ${this.#persistentCollisionObjects.size}, Children: ${this.#collisionObjects.children.length}`);
    }

    // Update the visibility state
    this.visible = newVisible;

    // If topic was just enabled, we'll recreate objects on next message
    if (!wasVisible && this.visible) {
      console.log(`✅ TOPIC ENABLED - Will recreate objects on next message for topic: ${this.userData.topic}`);
    }
  }

  #updateCollisionObjects(collisionObjects: CollisionObject[]): void {
    const settings = this.getSettings();

    // REPEATED MESSAGE: Print this exact message every time collision objects are received
    console.log("🎯 COLLISION OBJECTS RECEIVED - Processing collision objects now");

    // If topic is disabled, don't process collision objects and ensure everything is cleared
    if (!this.visible) {
      console.log("🎯 Topic is disabled - clearing any existing collision objects and skipping processing");
      this.#clearAllCollisionObjects();
      this.#persistentCollisionObjects.clear();
      return;
    }

    // PRINT THE WHOLE TOPIC DATA
    console.log("📊 COMPLETE TOPIC DATA:");
    console.log("📊 Planning Scene Data:", this.userData.planningScene);
    console.log("📊 Collision Objects Array:", collisionObjects);
    console.log("📊 User Data:", this.userData);
    console.log("📊 Settings:", settings);

    console.log("PlanningScene: Settings check - showCollisionObjects:", settings?.showCollisionObjects);
    console.log("PlanningScene: Settings check - visible:", settings?.visible);
    console.log("PlanningScene: Settings check - collisionObjectColor:", settings?.collisionObjectColor);

    // Ensure we have a default color
    const color = settings?.collisionObjectColor ?? "#ff0000";
    console.log("PlanningScene: Using collision object color:", color);

    if (!settings?.showCollisionObjects) {
      console.log("PlanningScene: Collision objects disabled in settings - this might be the issue!");
      console.log("PlanningScene: Current settings:", settings);
      // Don't return early - let's see what happens if we continue
      // return;
    }

    console.log(`PlanningScene: Processing ${collisionObjects.length} collision objects`);
    console.log(`PlanningScene: is_diff = ${this.userData.planningScene.is_diff}`);
    console.log(`PlanningScene: Persistent objects count = ${this.#persistentCollisionObjects.size}`);
    console.log(`PlanningScene: Current markers count = ${this.#markers.size}`);
    console.log(`PlanningScene: Planning scene frame: ${this.userData.frameId}`);

    // Show frame info for any collision objects in the current message
    for (const collisionObject of collisionObjects) {
      console.log(`PlanningScene: Collision object ${collisionObject.id} frame: ${collisionObject.header?.frame_id || 'undefined'}`);
    }

    // Show frame info for persistent objects
    console.log(`PlanningScene: Iterating through ${this.#persistentCollisionObjects.size} persistent objects`);
    for (const [objectId, persistentObject] of this.#persistentCollisionObjects) {
      console.log(`PlanningScene: Persistent object ${objectId}`);
      console.log(`PlanningScene: - Header:`, persistentObject.header);
      console.log(`PlanningScene: - Frame ID: ${persistentObject.header?.frame_id || 'undefined'}`);
      console.log(`PlanningScene: - Has primitive_poses: ${persistentObject.primitive_poses ? persistentObject.primitive_poses.length : 0}`);
      console.log(`PlanningScene: - Has mesh_poses: ${persistentObject.mesh_poses ? persistentObject.mesh_poses.length : 0}`);
    }

    // Handle differential updates vs complete scene updates
    const planningScene = this.userData.planningScene;
    if (planningScene.is_diff) {
      // This is a differential update - process each collision object based on its operation
      for (const collisionObject of collisionObjects) {
        console.log(`PlanningScene: Processing diff operation ${collisionObject.operation} for object ${collisionObject.id}`);
        this.#processCollisionObjectOperation(collisionObject, settings?.collisionObjectColor ?? "#ff0000");
      }

      // For differential updates, ensure all persistent objects are rendered
      // even if the current message has 0 collision objects
      if (collisionObjects.length === 0 && this.#persistentCollisionObjects.size > 0) {
        console.log(`PlanningScene: No new collision objects in diff, but ${this.#persistentCollisionObjects.size} persistent objects exist`);
        // Re-render all persistent objects to ensure they're visible
        for (const [objectId, persistentObject] of this.#persistentCollisionObjects) {
          if (!this.#markers.has(objectId)) {
            console.log(`PlanningScene: Re-rendering persistent object ${objectId}`);
            console.log(`PlanningScene: - Object frame: ${persistentObject.header?.frame_id || 'undefined'}`);
            console.log(`PlanningScene: - Has poses: primitive=${persistentObject.primitive_poses?.length || 0}, mesh=${persistentObject.mesh_poses?.length || 0}`);
            if (persistentObject.primitive_poses && persistentObject.primitive_poses.length > 0) {
              const pose = persistentObject.primitive_poses[0];
              if (pose) {
                console.log(`PlanningScene: - Primitive pose: (${pose.position.x}, ${pose.position.y}, ${pose.position.z})`);
                console.log(`PlanningScene: - Full primitive pose object:`, pose);
              }
            }
            this.#createCollisionObjectMarker(persistentObject, settings?.collisionObjectColor ?? "#ff0000");
          } else {
            console.log(`PlanningScene: Persistent object ${objectId} already has marker`);
            // Check marker visibility and position
            const existingMarker = this.#markers.get(objectId);
            if (existingMarker) {
              console.log(`PlanningScene: - Marker position: (${existingMarker.position.x}, ${existingMarker.position.y}, ${existingMarker.position.z})`);
              console.log(`PlanningScene: - Marker visible: ${existingMarker.visible}`);
              console.log(`PlanningScene: - Marker parent: ${existingMarker.parent?.name || 'no parent'}`);
              console.log(`PlanningScene: - Collision objects group visible: ${this.#collisionObjects.visible}`);
              console.log(`PlanningScene: - Renderable visible: ${this.visible}`);

              // FORCE RECREATION - Always recreate the marker to debug pose data
              console.log(`PlanningScene: 🔄 FORCING marker recreation for debugging...`);
              console.log(`PlanningScene: 🔄 About to call #createCollisionObjectMarker for ${objectId}`);
              console.log(`PlanningScene: 🔄 Persistent object data:`, persistentObject);
              console.log(`PlanningScene: 🔄 Color:`, settings?.collisionObjectColor ?? "#ff0000");

              // Remove the existing marker and recreate it
              console.log(`PlanningScene: 🔄 Removing existing marker...`);
              this.#removeCollisionObjectMarker(objectId);
              console.log(`PlanningScene: 🔄 Marker removed, markers count: ${this.#markers.size}`);

              console.log(`PlanningScene: 🔄 Calling #createCollisionObjectMarker...`);
              this.#createCollisionObjectMarker(persistentObject, settings?.collisionObjectColor ?? "#ff0000");
              console.log(`PlanningScene: 🔄 Finished calling #createCollisionObjectMarker for ${objectId}`);
              console.log(`PlanningScene: 🔄 Markers count after recreation: ${this.#markers.size}`);
            }
          }
        }
      }
    } else {
      // This is a complete scene update - clear existing objects and add new ones
      console.log("PlanningScene: Complete scene update - clearing all objects");
      this.#clearAllCollisionObjects();
      this.#persistentCollisionObjects.clear();

      for (const collisionObject of collisionObjects) {
        console.log(`PlanningScene: Adding object ${collisionObject.id} to persistent storage`);
        this.#persistentCollisionObjects.set(collisionObject.id, collisionObject);
        this.#createCollisionObjectMarker(collisionObject, settings?.collisionObjectColor ?? "#ff0000");
      }
    }
  }

  #processCollisionObjectOperation(collisionObject: CollisionObject, color: string): void {
    const operation = (collisionObject.operation as number) ?? 0; // Default to ADD if not specified

    console.log(`PlanningScene: Processing operation ${operation} for object ${collisionObject.id}`);

    // Handle different collision object operations
    if (operation === 0) { // ADD
      this.#persistentCollisionObjects.set(collisionObject.id, collisionObject);
      this.#createCollisionObjectMarker(collisionObject, color);
    } else if (operation === 1) { // REMOVE
      this.#persistentCollisionObjects.delete(collisionObject.id);
      this.#removeCollisionObjectMarker(collisionObject.id);
    } else if (operation === 2) { // APPEND
      // For APPEND, we add the object (same as ADD for now)
      this.#persistentCollisionObjects.set(collisionObject.id, collisionObject);
      this.#createCollisionObjectMarker(collisionObject, color);
    } else if (operation === 3) { // MOVE
      // For MOVE, we update the existing object
      this.#persistentCollisionObjects.set(collisionObject.id, collisionObject);
      this.#removeCollisionObjectMarker(collisionObject.id);
      this.#createCollisionObjectMarker(collisionObject, color);
    }
  }

  #clearAllCollisionObjects(): void {
    console.log(`🧹 CLEARING ALL COLLISION OBJECTS - Starting with ${this.#markers.size} markers`);

    // Remove all existing markers
    for (const [objectId] of this.#markers) {
      console.log(`🧹 Removing marker for object: ${objectId}`);
      this.#removeCollisionObjectMarker(objectId);
    }

    console.log(`🧹 CLEARING COMPLETE - Remaining markers: ${this.#markers.size}, Children: ${this.#collisionObjects.children.length}`);
  }

  #removeCollisionObjectMarker(objectId: string): void {
    const existingMarker = this.#markers.get(objectId);
    if (existingMarker) {
      console.log(`🗑️ Removing marker for ${objectId} from collision objects group`);
      this.#collisionObjects.remove(existingMarker);
      this.#markers.delete(objectId);
      console.log(`🗑️ Marker removed - Markers count: ${this.#markers.size}, Children count: ${this.#collisionObjects.children.length}`);
    } else {
      console.log(`🗑️ No marker found for ${objectId} to remove`);
    }
  }

  #createCollisionObjectMarker(collisionObject: CollisionObject, color: string = "#ff0000"): void {
    const objectId = collisionObject.id;

    console.log(`PlanningScene: 🎯 ENTERING #createCollisionObjectMarker for object ${objectId}`);
    console.log(`PlanningScene: 🎯 Creating marker for object ${objectId}`);

    // Don't create duplicate markers
    if (this.#markers.has(objectId)) {
      console.log(`PlanningScene: Marker for ${objectId} already exists, skipping`);
      return;
    }

    // Create a simple box marker for each collision object
    // In a more complete implementation, we would parse the actual geometry
    let pose = {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    };

    console.log(`PlanningScene: Raw top-level pose:`, collisionObject.pose);
    console.log(`PlanningScene: Raw primitive_poses:`, collisionObject.primitive_poses);
    console.log(`PlanningScene: Raw mesh_poses:`, collisionObject.mesh_poses);

    // Use top-level pose first, then primitive_poses, then fall back to mesh_poses
    if (collisionObject.pose && typeof collisionObject.pose === 'object' && collisionObject.pose.position && collisionObject.pose.orientation) {
      pose = collisionObject.pose;
      console.log(`PlanningScene: ✅ Using top-level pose with position:`, pose.position);
    } else if (collisionObject.primitive_poses && collisionObject.primitive_poses.length > 0) {
      const rawPose = collisionObject.primitive_poses[0];
      console.log(`PlanningScene: Raw primitive_poses[0]:`, rawPose);

      if (rawPose && typeof rawPose === 'object' && rawPose.position && rawPose.orientation) {
        pose = rawPose;
        console.log(`PlanningScene: ✅ Using primitive_poses[0] with position:`, pose.position);
      } else {
        console.log(`PlanningScene: ❌ primitive_poses[0] missing position/orientation:`, rawPose);
      }
    } else if (collisionObject.mesh_poses && collisionObject.mesh_poses.length > 0) {
      const rawPose = collisionObject.mesh_poses[0];
      console.log(`PlanningScene: Raw mesh_poses[0]:`, rawPose);

      if (rawPose && typeof rawPose === 'object' && rawPose.position && rawPose.orientation) {
        pose = rawPose;
        console.log(`PlanningScene: ✅ Using mesh_poses[0] with position:`, pose.position);
      } else {
        console.log(`PlanningScene: ❌ mesh_poses[0] missing position/orientation:`, rawPose);
      }
    } else {
      console.log(`PlanningScene: ❌ No poses found, using default pose at origin`);
    }

    // REMOVED: Individual frame transformation
    // The collision object pose is already in the planning scene frame
    // and the planning scene itself is positioned correctly via #updateScenePosition()

    console.log(`PlanningScene: Final pose for marker positioning:`, pose);
    console.log(`PlanningScene: Object ${objectId} pose: (${pose.position.x}, ${pose.position.y}, ${pose.position.z})`);
    console.log(`PlanningScene: Object frame: ${collisionObject.header?.frame_id || 'undefined'}, Scene frame: ${this.userData.frameId}`);

    // Use actual dimensions from collision object if available, otherwise default
    let scale = { x: 0.5, y: 0.5, z: 0.5 }; // Default scale
    if (collisionObject.primitives && collisionObject.primitives.length > 0 && collisionObject.primitives[0]) {
      const primitive = collisionObject.primitives[0];
      if (primitive.dimensions && primitive.dimensions.length >= 3) {
        scale = {
          x: primitive.dimensions[0] ?? 0.5,
          y: primitive.dimensions[1] ?? 0.5,
          z: primitive.dimensions[2] ?? 0.5
        };
      }
    }

    // Parse the color string (e.g., "#ff0000" or "#ff0000ff")
    const colorHex = color.startsWith('#') ? color.slice(1) : color;
    const r = parseInt(colorHex.slice(0, 2), 16) / 255;
    const g = parseInt(colorHex.slice(2, 4), 16) / 255;
    const b = parseInt(colorHex.slice(4, 6), 16) / 255;
    const a = colorHex.length > 6 ? parseInt(colorHex.slice(6, 8), 16) / 255 : 0.5;

    // Create a simple cube geometry for visualization
    const geometry = new THREE.BoxGeometry(scale.x, scale.y, scale.z);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b),
      transparent: true,
      opacity: a,
      wireframe: false, // Show as solid for better visibility
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Set position and orientation
    mesh.position.set(pose.position.x, pose.position.y, pose.position.z);
    mesh.quaternion.set(pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w);
    mesh.name = `collision-object-${objectId}`;

    // Ensure the mesh is in the base_link frame by setting its parent
    // The collision objects group should be in the same frame as the planning scene
    this.#collisionObjects.add(mesh);
    this.#markers.set(objectId, mesh);

    console.log(`PlanningScene: ✅ Mesh position set to (${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z})`);
    console.log(`PlanningScene: ✅ Mesh world position: (${mesh.getWorldPosition(new THREE.Vector3()).x}, ${mesh.getWorldPosition(new THREE.Vector3()).y}, ${mesh.getWorldPosition(new THREE.Vector3()).z})`);

    console.log(`PlanningScene: ✅ Created marker for ${objectId} at position (${pose.position.x}, ${pose.position.y}, ${pose.position.z})`);
    console.log(`PlanningScene: ✅ Marker scale (${scale.x}, ${scale.y}, ${scale.z})`);
    console.log(`PlanningScene: ✅ Collision object frame: ${collisionObject.header?.frame_id || 'undefined'}`);
    console.log(`PlanningScene: ✅ Planning scene frame: ${this.userData.frameId}`);
    console.log(`PlanningScene: ✅ Total collision objects group children: ${this.#collisionObjects.children.length}`);
    console.log(`PlanningScene: ✅ Total markers: ${this.#markers.size}`);

    // Verify the marker is actually positioned correctly
    console.log(`PlanningScene: 🔍 VERIFICATION - Marker local position: (${mesh.position.x}, ${mesh.position.y}, ${mesh.position.z})`);
    console.log(`PlanningScene: 🔍 VERIFICATION - Scene position: (${this.position.x}, ${this.position.y}, ${this.position.z})`);
    console.log(`PlanningScene: 🔍 VERIFICATION - Expected world position: (${mesh.position.x + this.position.x}, ${mesh.position.y + this.position.y}, ${mesh.position.z + this.position.z})`);

  }



  public override dispose(): void {
    // Clean up geometries and materials
    this.#collisionObjects.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.#collisionObjects.clear();
    this.#markers.clear();
  }
}
