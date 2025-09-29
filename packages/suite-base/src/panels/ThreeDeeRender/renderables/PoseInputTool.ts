// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { IRenderer } from "../IRenderer";
import { Renderable } from "../Renderable";
import { SceneExtension } from "../SceneExtension";
import { Marker, MarkerAction, MarkerType, TIME_ZERO } from "../ros";
import { RenderableArrow } from "./markers/RenderableArrow";
import { RenderableSphere } from "./markers/RenderableSphere";
import { makePose, Pose } from "../transforms/geometry";

const UNIT_X = new THREE.Vector3(1, 0, 0);
const tempVec3 = new THREE.Vector3();

export type PoseInputState = "idle" | "active" | "dragging-pose";

function makePositionMarker(): Marker {
  return {
    header: { frame_id: "", stamp: { sec: 0, nsec: 0 } },
    ns: "",
    id: 0,
    type: MarkerType.SPHERE,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x: 0.3, y: 0.3, z: 0.3 },
    color: { r: 0, g: 1, b: 0, a: 0.8 }, // Green for position
    lifetime: TIME_ZERO,
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

function makeOrientationMarker(): Marker {
  return {
    header: { frame_id: "", stamp: { sec: 0, nsec: 0 } },
    ns: "",
    id: 0,
    type: MarkerType.ARROW,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x: 1.5, y: 0.15, z: 0.15 },
    color: { r: 0, g: 0, b: 1, a: 0.8 }, // Blue for orientation
    lifetime: TIME_ZERO,
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

export interface PoseInputEventMap extends THREE.Object3DEventMap {
  "foxglove.pose-input-start": object;
  "foxglove.pose-input-end": object;
  "foxglove.pose-input-submit": { pose: Pose };
}

export class PoseInputTool extends SceneExtension<Renderable, PoseInputEventMap> {
  #positionMarker: RenderableSphere;
  #orientationMarker: RenderableArrow;

  public state: PoseInputState = "idle";

  #position?: THREE.Vector3;
  #orientationPoint?: THREE.Vector3;
  #dragStartPoint?: THREE.Vector3;

  public constructor(renderer: IRenderer) {
    super("foxglove.PoseInputTool", renderer);

    this.#positionMarker = new RenderableSphere("", makePositionMarker(), undefined, this.renderer);
    this.#orientationMarker = new RenderableArrow(
      "",
      makeOrientationMarker(),
      undefined,
      this.renderer,
    );
    this.#positionMarker.visible = false;
    this.#positionMarker.mesh.userData.picking = false;
    this.#orientationMarker.visible = false;
    this.#orientationMarker.shaftMesh.userData.picking = false;
    this.#orientationMarker.headMesh.userData.picking = false;
    this.add(this.#positionMarker);
    this.add(this.#orientationMarker);
    this.#setState("active");
    // Ensure camera controls are disabled when starting in active state
    // Use setTimeout to ensure renderer is fully initialized
    setTimeout(() => {
      this.#setControlsEnabled(false);
    }, 0);
  }

  public override dispose(): void {
    super.dispose();
    this.#orientationMarker.dispose();
    this.#positionMarker.dispose();
    this.renderer.input.removeListener("mousedown", this.#handleMouseDown);
    this.renderer.input.removeListener("mousemove", this.#handleMouseMove);
    this.renderer.input.removeListener("mouseup", this.#handleMouseUp);
    // Ensure camera controls are re-enabled when disposing
    this.#setControlsEnabled(true);
  }

  public start(): void {
    this.#setState("active");
  }

  public stop(): void {
    this.#setState("idle");
  }

  #setControlsEnabled(enabled: boolean): void {
    // Safely enable/disable camera controls with proper null checks
    if (this.renderer?.cameraHandler && "setControlsEnabled" in this.renderer.cameraHandler) {
      this.renderer.cameraHandler.setControlsEnabled?.(enabled);
    }
  }

  #setState(state: PoseInputState): void {
    this.state = state;
    switch (state) {
      case "idle":
        this.#position = this.#orientationPoint = this.#dragStartPoint = undefined;
        this.renderer.input.removeListener("mousedown", this.#handleMouseDown);
        this.renderer.input.removeListener("mousemove", this.#handleMouseMove);
        this.renderer.input.removeListener("mouseup", this.#handleMouseUp);
        // Re-enable camera controls when pose input ends
        this.#setControlsEnabled(true);
        this.dispatchEvent({ type: "foxglove.pose-input-end" });
        break;
      case "active":
        this.renderer.input.addListener("mousedown", this.#handleMouseDown);
        this.renderer.input.addListener("mousemove", this.#handleMouseMove);
        this.renderer.input.addListener("mouseup", this.#handleMouseUp);
        // Disable camera controls when tool is active
        this.#setControlsEnabled(false);
        this.dispatchEvent({ type: "foxglove.pose-input-start" });
        break;
      case "dragging-pose":
        // Already have listeners from "active" state
        break;
    }
    this.#render();
  }

  #handleMouseMove = (
    _cursorCoords: THREE.Vector2,
    worldSpaceCursorCoords: THREE.Vector3 | undefined,
    _event: MouseEvent,
  ) => {
    if (!worldSpaceCursorCoords || this.state !== "dragging-pose" || !this.#dragStartPoint) {
      return;
    }

    // Project to 2D ground plane (Z=0)
    const groundPoint = new THREE.Vector3(worldSpaceCursorCoords.x, worldSpaceCursorCoords.y, 0);

    // Update orientation point during drag
    this.#orientationPoint = groundPoint.clone();
    this.#render();
  };

  #handleMouseDown = (
    _cursorCoords: THREE.Vector2,
    worldSpaceCursorCoords: THREE.Vector3 | undefined,
    _event: MouseEvent,
  ) => {
    if (!worldSpaceCursorCoords || this.state !== "active") {
      return;
    }

    // Project to 2D ground plane (Z=0)
    const groundPoint = new THREE.Vector3(worldSpaceCursorCoords.x, worldSpaceCursorCoords.y, 0);

    // Set position and start dragging
    this.#position = groundPoint.clone();
    this.#dragStartPoint = groundPoint.clone();
    this.#orientationPoint = groundPoint.clone(); // Start with same point for default orientation
    this.#setState("dragging-pose");
  };

  #handleMouseUp = (
    _cursorCoords: THREE.Vector2,
    _worldSpaceCursorCoords: THREE.Vector3 | undefined,
    _event: MouseEvent,
  ) => {
    if (this.state !== "dragging-pose" || !this.#position || !this.#orientationPoint) {
      return;
    }

    // Calculate orientation from position to orientation point
    const direction = tempVec3.subVectors(this.#orientationPoint, this.#position);

    // For 2D pose, we only care about yaw rotation (around Z-axis)
    const yaw = Math.atan2(direction.y, direction.x);
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, yaw));

    this.dispatchEvent({
      type: "foxglove.pose-input-submit",
      pose: {
        position: { x: this.#position.x, y: this.#position.y, z: this.#position.z },
        orientation: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
      },
    });

    this.#setState("idle");
  };

  #render() {
    // Show position marker when dragging
    if (this.#position && this.state === "dragging-pose") {
      this.#positionMarker.visible = true;
      this.#positionMarker.position.copy(this.#position);
    } else {
      this.#positionMarker.visible = false;
    }

    // Show orientation marker when dragging
    if (this.#position && this.state === "dragging-pose") {
      this.#orientationMarker.visible = true;
      this.#orientationMarker.position.copy(this.#position);

      if (this.#orientationPoint) {
        // Calculate direction from position to orientation point
        const direction = tempVec3.subVectors(this.#orientationPoint, this.#position).normalize();
        this.#orientationMarker.quaternion.setFromUnitVectors(UNIT_X, direction);
      } else {
        // Default orientation (pointing in +X direction)
        this.#orientationMarker.quaternion.set(0, 0, 0, 1);
      }
    } else {
      this.#orientationMarker.visible = false;
    }

    this.renderer.queueAnimationFrame();
  }
}
