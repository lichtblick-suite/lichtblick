// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { RenderableArrow } from "./markers/RenderableArrow";
import { RenderableSphere } from "./markers/RenderableSphere";
import type { IRenderer } from "../IRenderer";
import { Renderable, BaseUserData } from "../Renderable";
import { SceneExtension } from "../SceneExtension";
import { Marker, MarkerAction, MarkerType, TIME_ZERO } from "../ros";
import { makePose, Point, Pose } from "../transforms/geometry";

const UNIT_X = new THREE.Vector3(1, 0, 0);
const tempVec3 = new THREE.Vector3();
export type PublishClickType = "pose_estimate" | "pose" | "point";

export type PublishClickState = "idle" | "place-first-point" | "place-second-point";

function makeArrowMarker(type: PublishClickType): Marker {
  return {
    header: { frame_id: "", stamp: { sec: 0, nsec: 0 } },
    ns: "",
    id: 0,
    type: MarkerType.ARROW,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x: 2, y: 0.25, z: 0.25 },
    color: type === "pose_estimate" ? { r: 0, g: 1, b: 1, a: 1 } : { r: 1, g: 0, b: 1, a: 1 },
    lifetime: TIME_ZERO,
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

function makeSphereMarker(): Marker {
  return {
    header: { frame_id: "", stamp: { sec: 0, nsec: 0 } },
    ns: "",
    id: 0,
    type: MarkerType.SPHERE,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x: 0.25, y: 0.25, z: 0.25 },
    color: { r: 1, g: 1, b: 0, a: 1 },
    lifetime: TIME_ZERO,
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

export type PublishClickEvent =
  | { type: "foxglove.publish-start" }
  | { type: "foxglove.publish-end" }
  | { type: "foxglove.publish-type-change" }
  | { type: "foxglove.publish-submit"; publishClickType: "point"; point: Point }
  | { type: "foxglove.publish-submit"; publishClickType: "pose" | "pose_estimate"; pose: Pose };

export class PublishClickTool extends SceneExtension<Renderable<BaseUserData>, PublishClickEvent> {
  #sphere: RenderableSphere;
  #arrow: RenderableArrow;

  public publishClickType: PublishClickType = "point";
  public state: PublishClickState = "idle";

  #point1?: THREE.Vector3;
  #point2?: THREE.Vector3;

  public constructor(renderer: IRenderer) {
    super("foxglove.PublishClickTool", renderer);

    this.#sphere = new RenderableSphere("", makeSphereMarker(), undefined, this.renderer);
    this.#arrow = new RenderableArrow(
      "",
      makeArrowMarker(this.publishClickType),
      undefined,
      this.renderer,
    );
    this.#sphere.visible = false;
    this.#sphere.mesh.userData.picking = false;
    this.#arrow.visible = false;
    this.#arrow.shaftMesh.userData.picking = false;
    this.#arrow.headMesh.userData.picking = false;
    this.add(this.#sphere);
    this.add(this.#arrow);
    this.#setState("idle");
  }

  public override dispose(): void {
    super.dispose();
    this.#arrow.dispose();
    this.#sphere.dispose();
    this.renderer.input.removeListener("click", this.#handleClick);
    this.renderer.input.removeListener("mousemove", this.#handleMouseMove);
  }

  public setPublishClickType(type: PublishClickType): void {
    this.publishClickType = type;
    this.#arrow.update(makeArrowMarker(this.publishClickType), undefined);
    this.dispatchEvent({ type: "foxglove.publish-type-change" });
  }

  public start(): void {
    this.#setState("place-first-point");
  }

  public stop(): void {
    this.#setState("idle");
  }

  #setState(state: PublishClickState): void {
    this.state = state;
    switch (state) {
      case "idle":
        this.#point1 = this.#point2 = undefined;
        this.renderer.input.removeListener("click", this.#handleClick);
        this.renderer.input.removeListener("mousemove", this.#handleMouseMove);
        this.dispatchEvent({ type: "foxglove.publish-end" });
        break;
      case "place-first-point":
        this.renderer.input.addListener("click", this.#handleClick);
        this.renderer.input.addListener("mousemove", this.#handleMouseMove);
        this.dispatchEvent({ type: "foxglove.publish-start" });
        break;
      case "place-second-point":
        break;
    }
    this.#render();
  }

  #handleMouseMove = (
    _cursorCoords: THREE.Vector2,
    worldSpaceCursorCoords: THREE.Vector3 | undefined,
    _event: MouseEvent,
  ) => {
    if (!worldSpaceCursorCoords) {
      return;
    }
    switch (this.state) {
      case "idle":
        break;
      case "place-first-point":
        (this.#point1 ??= new THREE.Vector3()).copy(worldSpaceCursorCoords);
        break;
      case "place-second-point":
        (this.#point2 ??= new THREE.Vector3()).copy(worldSpaceCursorCoords);
        break;
    }
    this.#render();
  };

  #handleClick = (
    _cursorCoords: THREE.Vector2,
    worldSpaceCursorCoords: THREE.Vector3 | undefined,
    _event: MouseEvent,
  ) => {
    if (!worldSpaceCursorCoords) {
      return;
    }

    switch (this.state) {
      case "idle":
        break;
      case "place-first-point":
        this.#point1 = worldSpaceCursorCoords.clone();
        if (this.publishClickType === "point") {
          this.dispatchEvent({
            type: "foxglove.publish-submit",
            publishClickType: this.publishClickType,
            point: { x: this.#point1.x, y: this.#point1.y, z: this.#point1.z },
          });
          this.#setState("idle");
        } else {
          this.#setState("place-second-point");
        }
        break;
      case "place-second-point":
        this.#point2 = worldSpaceCursorCoords.clone();
        if (this.#point1 && this.publishClickType !== "point") {
          const p = this.#point1.clone();
          const q = new THREE.Quaternion().setFromUnitVectors(
            UNIT_X,
            tempVec3.subVectors(this.#point2, this.#point1).normalize(),
          );
          this.dispatchEvent({
            type: "foxglove.publish-submit",
            publishClickType: this.publishClickType,
            pose: {
              position: { x: p.x, y: p.y, z: p.z },
              orientation: { x: q.x, y: q.y, z: q.z, w: q.w },
            },
          });
        }
        this.#setState("idle");
        break;
    }
    this.#render();
  };

  #render() {
    if (this.publishClickType === "point") {
      this.#arrow.visible = false;
      if (this.#point1) {
        this.#sphere.visible = true;
        this.#sphere.position.copy(this.#point1);
      } else {
        this.#sphere.visible = false;
      }
    } else {
      this.#sphere.visible = false;
      if (this.#point1) {
        this.#arrow.visible = true;

        this.#arrow.position.copy(this.#point1);
        if (this.#point2) {
          this.#arrow.quaternion.setFromUnitVectors(
            UNIT_X,
            tempVec3.subVectors(this.#point2, this.#point1).normalize(),
          );
        } else {
          this.#arrow.quaternion.set(0, 0, 0, 1);
        }
      } else {
        this.#arrow.visible = false;
      }
    }

    this.renderer.queueAnimationFrame();
  }
}
