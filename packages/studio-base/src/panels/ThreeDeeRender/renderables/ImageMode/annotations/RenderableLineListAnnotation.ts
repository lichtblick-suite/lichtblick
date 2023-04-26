// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry";

import { PinholeCameraModel } from "@foxglove/den/image";
import { PointsAnnotation as NormalizedPointsAnnotation } from "@foxglove/studio-base/panels/Image/types";

import { BaseUserData, Renderable } from "../../../Renderable";
import { SRGBToLinear } from "../../../color";

const tempVec3 = new THREE.Vector3();

class PickingMaterial extends LineMaterial {
  public constructor() {
    super({
      worldUnits: false,
      vertexColors: false,
      linewidth: 0,
      transparent: false,
      depthWrite: true,
    });
    this.uniforms.objectId = { value: [NaN, NaN, NaN, NaN] };
  }

  public override onBeforeCompile(shader: THREE.Shader, renderer: THREE.WebGLRenderer): void {
    super.onBeforeCompile(shader, renderer);
    shader.fragmentShader = /* glsl */ `
      uniform vec4 objectId;
      void main() {
        gl_FragColor = objectId;
      }
    `;
  }
}

export class RenderableLineListAnnotation extends Renderable<
  BaseUserData,
  /*TRenderer=*/ undefined
> {
  #geometry?: LineSegmentsGeometry;
  #lineSegments: LineSegments2;
  #pickingMaterial: PickingMaterial;
  #material: LineMaterial;
  #capacity?: number;
  #positionBuffer = new Float32Array();
  #colorBuffer = new Uint8Array();

  #scale = 0;
  #canvasWidth = 0;
  #canvasHeight = 0;
  #scaleNeedsUpdate = false;

  #annotation?: NormalizedPointsAnnotation & { style: "line_list" };
  #annotationNeedsUpdate = false;

  #cameraModel?: PinholeCameraModel;
  #cameraModelNeedsUpdate = false;

  public constructor() {
    super("foxglove.ImageAnnotations.LineList", undefined, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId: "",
      pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 0 } },
      settingsPath: [],
      settings: { visible: true },
    });

    this.#geometry = new LineSegmentsGeometry();
    this.#material = new LineMaterial({
      worldUnits: false,
      vertexColors: true,
      linewidth: 0,
      transparent: false,
      depthWrite: true,
    });
    this.#lineSegments = new LineSegments2(this.#geometry, this.#material);
    this.#lineSegments.userData.pickingMaterial = this.#pickingMaterial = new PickingMaterial();
    this.add(this.#lineSegments);
  }

  public override dispose(): void {
    this.#geometry?.dispose();
    this.#material.dispose();
    this.#pickingMaterial.dispose();
    super.dispose();
  }

  public setScale(
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
    _pixelRatio: number,
  ): void {
    this.#scaleNeedsUpdate ||=
      scale !== this.#scale ||
      canvasWidth !== this.#canvasWidth ||
      canvasHeight !== this.#canvasHeight;
    this.#scale = scale;
    this.#canvasWidth = canvasWidth;
    this.#canvasHeight = canvasHeight;
  }

  public setCameraModel(cameraModel: PinholeCameraModel | undefined): void {
    this.#cameraModelNeedsUpdate ||= this.#cameraModel !== cameraModel;
    this.#cameraModel = cameraModel;
  }

  public setAnnotation(annotation: NormalizedPointsAnnotation & { style: "line_list" }): void {
    this.#annotationNeedsUpdate ||= this.#annotation !== annotation;
    this.#annotation = annotation;
  }

  public update(): void {
    if (!this.#annotation || !this.#cameraModel) {
      this.visible = false;
      return;
    }

    const { points, outlineColor, outlineColors, thickness } = this.#annotation;
    if (!outlineColor || outlineColor.a <= 0 || thickness <= 0 || points.length < 2) {
      this.visible = false;
      return;
    }
    this.visible = true;

    // Update line width if thickness or scale has changed
    if (this.#annotationNeedsUpdate || this.#scaleNeedsUpdate) {
      this.#material.resolution.set(this.#canvasWidth, this.#canvasHeight);
      this.#material.linewidth = thickness * this.#scale;
      this.#material.needsUpdate = true;
      this.#pickingMaterial.resolution.set(this.#canvasWidth, this.#canvasHeight);
      this.#pickingMaterial.linewidth = thickness * this.#scale;
      this.#pickingMaterial.needsUpdate = true;
      this.#scaleNeedsUpdate = false;
    }

    if (this.#annotationNeedsUpdate || this.#cameraModelNeedsUpdate) {
      this.#annotationNeedsUpdate = false;
      this.#cameraModelNeedsUpdate = false;
      if (this.#capacity == undefined || !this.#geometry || points.length > this.#capacity) {
        // Need to recreate the geometry when length changes: https://github.com/mrdoob/three.js/issues/21488
        this.#geometry?.dispose();
        this.#capacity = points.length;
        this.#positionBuffer = new Float32Array(points.length * 3);
        this.#colorBuffer = new Uint8Array(points.length * 8);
        this.#geometry = new LineSegmentsGeometry();
        this.#lineSegments.geometry = this.#geometry;
      }

      const hasExactColors = outlineColors.length === points.length / 2;

      const positions = this.#positionBuffer;
      const colors = this.#colorBuffer;
      let hasTransparency = false;
      for (let i = 0; i < points.length; i++) {
        // Support the case where outline_colors is half the length of points,
        // one color per line, and where outline_colors matches the length of
        // points (although we only use the first color in this case). Fall back
        // to marker.outline_color as needed
        const color = hasExactColors ? outlineColors[i >>> 1]! : outlineColors[i] ?? outlineColor;
        const point = points[i]!;
        if (this.#cameraModel.projectPixelTo3dPlane(tempVec3, point)) {
          positions[i * 3 + 0] = tempVec3.x;
          positions[i * 3 + 1] = tempVec3.y;
          positions[i * 3 + 2] = tempVec3.z;
          colors[i * 4 + 0] = SRGBToLinear(color.r) * 255;
          colors[i * 4 + 1] = SRGBToLinear(color.g) * 255;
          colors[i * 4 + 2] = SRGBToLinear(color.b) * 255;
          colors[i * 4 + 3] = color.a * 255;
          if (color.a < 1) {
            hasTransparency = true;
          }
        } else {
          positions[i * 3 + 0] = NaN;
          positions[i * 3 + 1] = NaN;
          positions[i * 3 + 2] = NaN;
        }
      }

      this.#material.transparent = hasTransparency;
      this.#material.depthWrite = !hasTransparency;
      this.#material.needsUpdate = true;

      this.#geometry.setPositions(positions);
      this.#lineSegments.computeLineDistances();

      this.#geometry.instanceCount = points.length >>> 1;

      // [rgba, rgba]
      const instanceColorBuffer = new THREE.InstancedInterleavedBuffer(colors, 8, 1);
      this.#geometry.setAttribute(
        "instanceColorStart",
        new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 0, true),
      );
      this.#geometry.setAttribute(
        "instanceColorEnd",
        new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 4, true),
      );
    }
  }
}
