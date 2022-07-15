// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import * as THREE from "three";

import { Renderable, BaseUserData } from "../Renderable";
import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";

type MeasurementState = "idle" | "place-first-point" | "place-second-point";

/**
 * A material that interprets the input mesh coordinates in pixel space, regardless of the camera
 * perspective/zoom level.
 */
class FixedSizeMeshMaterial extends THREE.ShaderMaterial {
  constructor({ color }: { color: THREE.ColorRepresentation }) {
    super({
      vertexShader: /* glsl */ `
        #include <common>
        uniform vec2 canvasSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(0., 0., 0., 1.);

          // Adapted from THREE.ShaderLib.sprite
          vec2 scale;
          scale.x = length(vec3(modelMatrix[0].xyz));
          scale.y = length(vec3(modelMatrix[1].xyz));

          gl_Position = projectionMatrix * mvPosition;

          // Add position after projection to maintain constant pixel size
          gl_Position.xy += position.xy / canvasSize * scale * gl_Position.w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        void main() {
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        canvasSize: { value: [0, 0] },
        color: { value: new THREE.Color(color).convertSRGBToLinear() },
      },
    });
  }
}

type MeasurementEvent =
  | { type: "foxglove.measure-start" }
  | { type: "foxglove.measure-change" }
  | { type: "foxglove.measure-end" };

export class MeasurementTool extends SceneExtension<Renderable<BaseUserData>, MeasurementEvent> {
  private circleGeometry = new THREE.CircleGeometry(5, 16);
  private circleMaterial = new FixedSizeMeshMaterial({ color: 0xff0000 });
  private circle1 = new THREE.Mesh(this.circleGeometry, this.circleMaterial);
  private circle2 = new THREE.Mesh(this.circleGeometry, this.circleMaterial);

  private linePositionAttribute = new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3);
  private line = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xff0000 }),
  );

  private point1NeedsUpdate = false;
  private point2NeedsUpdate = false;

  point1?: THREE.Vector3;
  point2?: THREE.Vector3;
  distance?: number;

  state: MeasurementState = "idle";

  constructor(renderer: Renderer) {
    super("foxglove.MeasurementTool", renderer);

    this.line.frustumCulled = false;
    this.line.geometry.setAttribute("position", this.linePositionAttribute);
    this.circle1.visible = false;
    this.circle2.visible = false;
    this.add(this.circle1);
    this.add(this.circle2);
    this.add(this.line);
    this._setState("idle");
  }

  override dispose(): void {
    super.dispose();
    this.circleGeometry.dispose();
    this.circleMaterial.dispose();
    this.line.geometry.dispose();
    this.line.material.dispose();
    this.renderer.input.removeListener("click", this._handleClick);
    this.renderer.input.removeListener("mousemove", this._handleMouseMove);
  }

  startMeasuring(): void {
    this._setState("place-first-point");
  }

  stopMeasuring(): void {
    this.point1 = this.point2 = this.distance = undefined;
    this._setState("idle");
  }

  override startFrame(currentTime: bigint, renderFrameId: string, fixedFrameId: string): void {
    super.startFrame(currentTime, renderFrameId, fixedFrameId);
    this.circleMaterial.uniforms.canvasSize!.value[0] = this.renderer.input.canvasSize.x;
    this.circleMaterial.uniforms.canvasSize!.value[1] = this.renderer.input.canvasSize.y;
  }

  private _setState(state: MeasurementState): void {
    this.state = state;
    switch (state) {
      case "idle":
        this.renderer.input.removeListener("click", this._handleClick);
        this.renderer.input.removeListener("mousemove", this._handleMouseMove);
        this.dispatchEvent({ type: "foxglove.measure-end" });
        break;
      case "place-first-point":
        this.point1 = this.point2 = this.distance = undefined;
        this.renderer.input.addListener("click", this._handleClick);
        this.renderer.input.addListener("mousemove", this._handleMouseMove);
        this.dispatchEvent({ type: "foxglove.measure-start" });
        break;
      case "place-second-point":
        break;
    }
    this._updateDistance();
    this._render();
  }

  private _handleMouseMove = (
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
        (this.point1 ??= new THREE.Vector3()).copy(worldSpaceCursorCoords);
        this.point1NeedsUpdate = true;
        break;
      case "place-second-point":
        (this.point2 ??= new THREE.Vector3()).copy(worldSpaceCursorCoords);
        this.point2NeedsUpdate = true;
        this._updateDistance();
        break;
    }
    this._render();
  };

  private _updateDistance() {
    this.distance = this.point1 && this.point2 ? this.point1.distanceTo(this.point2) : undefined;
    this.dispatchEvent({ type: "foxglove.measure-change" });
  }

  private _handleClick = (
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
        this.point1 = worldSpaceCursorCoords.clone();
        this.point1NeedsUpdate = true;
        this._setState("place-second-point");
        break;
      case "place-second-point":
        this.point2 = worldSpaceCursorCoords.clone();
        this.point2NeedsUpdate = true;
        this._setState("idle");
        break;
    }
    this._render();
  };

  private _render() {
    if (this.point1) {
      this.circle1.visible = true;
      this.circle1.position.copy(this.point1);

      if (this.point1NeedsUpdate) {
        this.linePositionAttribute.setXYZ(0, this.point1.x, this.point1.y, this.point1.z);
        this.linePositionAttribute.needsUpdate = true;
        this.point1NeedsUpdate = false;
      }
    } else {
      this.circle1.visible = false;
    }

    if (this.point2) {
      this.circle2.visible = true;
      this.circle2.position.copy(this.point2);

      if (this.point2NeedsUpdate) {
        this.linePositionAttribute.setXYZ(1, this.point2.x, this.point2.y, this.point2.z);
        this.linePositionAttribute.needsUpdate = true;
        this.point2NeedsUpdate = false;
      }
    } else {
      this.circle2.visible = false;
    }

    this.line.visible = this.point1 != undefined && this.point2 != undefined;

    this.renderer.queueAnimationFrame();
  }
}
