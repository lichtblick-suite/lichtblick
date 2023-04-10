// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import * as THREE from "three";

import { Label } from "@foxglove/three-text";

import type { IRenderer } from "../IRenderer";
import { Renderable, BaseUserData } from "../Renderable";
import { SceneExtension } from "../SceneExtension";

type MeasurementState = "idle" | "place-first-point" | "place-second-point";

/** A renderOrder value that should result in rendering after most/all other objects in the scene */
const LATE_RENDER_ORDER = 9999999;

/**
 * A material that interprets the input mesh coordinates in pixel space, regardless of the camera
 * perspective/zoom level.
 */
class FixedSizeMeshMaterial extends THREE.ShaderMaterial {
  public constructor({
    color,
    ...params
  }: { color: THREE.ColorRepresentation } & THREE.MaterialParameters) {
    super({
      ...params,
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

type MeasurementEvent = { type: "foxglove.measure-start" } | { type: "foxglove.measure-end" };

export class MeasurementTool extends SceneExtension<Renderable<BaseUserData>, MeasurementEvent> {
  private circleGeometry = new THREE.CircleGeometry(5, 16);
  private circleMaterial = new FixedSizeMeshMaterial({
    color: 0xff0000,
    depthTest: false,
    depthWrite: false,
  });
  private circle1 = new THREE.Mesh(this.circleGeometry, this.circleMaterial);
  private circle2 = new THREE.Mesh(this.circleGeometry, this.circleMaterial);

  private linePositionAttribute = new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3);
  private line = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xff0000 }),
  );
  /**
   * A dashed copy of the line drawn with inverse depth test so the line can still be visible when
   * it's occluded
   */
  private lineOccluded = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({
      color: 0xff0000,
      dashSize: 1,
      gapSize: 1,
      depthWrite: false,
      depthFunc: THREE.GreaterDepth, // opposite of default THREE.LessEqualDepth
    }),
  );

  private label: Label;

  private point1NeedsUpdate = false;
  private point2NeedsUpdate = false;

  private point1?: THREE.Vector3;
  private point2?: THREE.Vector3;

  public state: MeasurementState = "idle";

  public constructor(renderer: IRenderer) {
    super("foxglove.MeasurementTool", renderer);

    this.line.userData.picking = false;
    this.lineOccluded.userData.picking = false;
    this.circle1.userData.picking = false;
    this.circle2.userData.picking = false;

    this.label = renderer.labelPool.acquire();
    this.label.visible = false;
    this.label.setBillboard(true);
    this.label.setSizeAttenuation(false);
    this.label.setLineHeight(12);
    this.label.setColor(1, 0, 0);

    // Make the label appear on top of other objects in the scene so it doesn't get clipped/occluded
    this.label.renderOrder = LATE_RENDER_ORDER;
    this.label.material.depthTest = false;
    this.label.material.depthWrite = false;
    this.label.material.transparent = true;

    this.lineOccluded.renderOrder = LATE_RENDER_ORDER;
    this.circle1.renderOrder = LATE_RENDER_ORDER;
    this.circle2.renderOrder = LATE_RENDER_ORDER;

    this.line.frustumCulled = false;
    this.lineOccluded.frustumCulled = false;
    this.line.geometry.setAttribute("position", this.linePositionAttribute);
    this.lineOccluded.geometry.setAttribute("position", this.linePositionAttribute);
    this.circle1.visible = false;
    this.circle2.visible = false;
    this.add(this.circle1);
    this.add(this.circle2);
    this.add(this.line);
    this.add(this.lineOccluded);
    this.add(this.label);
    this._setState("idle");
  }

  public override dispose(): void {
    super.dispose();
    this.renderer.labelPool.release(this.label);
    this.circleGeometry.dispose();
    this.circleMaterial.dispose();
    this.line.geometry.dispose();
    this.line.material.dispose();
    this.lineOccluded.geometry.dispose();
    this.lineOccluded.material.dispose();
    this.renderer.input.removeListener("click", this._handleClick);
    this.renderer.input.removeListener("mousemove", this._handleMouseMove);
  }

  public startMeasuring(): void {
    this._setState("place-first-point");
  }

  public stopMeasuring(): void {
    this.point1 = this.point2 = undefined;
    this._setState("idle");
  }

  public override startFrame(
    currentTime: bigint,
    renderFrameId: string,
    fixedFrameId: string,
  ): void {
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
        this.point1 = this.point2 = undefined;
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
    if (this.point1 && this.point2) {
      this.label.setText(this.point1.distanceTo(this.point2).toFixed(2));
    }
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
        this.lineOccluded.computeLineDistances();
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
        this.lineOccluded.computeLineDistances();
        this.point2NeedsUpdate = false;
      }
    } else {
      this.circle2.visible = false;
    }

    if (this.point1 && this.point2) {
      this.line.visible = true;
      this.lineOccluded.visible = true;
      this.label.visible = true;
      this.label.position.copy(this.point1).lerp(this.point2, 0.5);
    } else {
      this.line.visible = false;
      this.lineOccluded.visible = false;
      this.label.visible = false;
    }

    this.renderer.queueAnimationFrame();
  }
}
