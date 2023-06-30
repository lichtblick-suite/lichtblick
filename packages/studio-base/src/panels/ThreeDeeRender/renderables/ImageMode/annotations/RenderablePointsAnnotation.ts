// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { PinholeCameraModel } from "@foxglove/den/image";
import { RosObject, RosValue } from "@foxglove/studio-base/players/types";

import {
  ANNOTATION_RENDER_ORDER,
  annotationRenderOrderMaterialProps,
} from "./annotationRenderOrder";
import { getAnnotationAtPath } from "./normalizeAnnotations";
import { PointsAnnotation as NormalizedPointsAnnotation } from "./types";
import { DynamicBufferGeometry } from "../../../DynamicBufferGeometry";
import { BaseUserData, Renderable } from "../../../Renderable";
import { SRGBToLinear } from "../../../color";

const tempVec3 = new THREE.Vector3();

class PickingMaterial extends THREE.ShaderMaterial {
  public constructor() {
    super({
      vertexShader: THREE.ShaderChunk.points_vert,
      fragmentShader: /* glsl */ `
        uniform vec4 objectId;
        void main() {
          gl_FragColor = objectId;
        }
      `,
      uniforms: {
        ...THREE.UniformsLib.points,
        ...THREE.UniformsLib.fog,
        objectId: { value: [NaN, NaN, NaN, NaN] },
      },
    });
  }
}

/**
 * 2D points annotation with style=points (points rendered as dots).
 */
export class RenderablePointsAnnotation extends Renderable<BaseUserData, /*TRenderer=*/ undefined> {
  #geometry: DynamicBufferGeometry;
  #points: THREE.Points;
  #pointsMaterial: THREE.PointsMaterial;
  #pickingMaterial: PickingMaterial;

  #scale = 0;
  #pixelRatio = 0;
  #scaleNeedsUpdate = false;

  #originalMessage?: RosObject;

  #annotation?: NormalizedPointsAnnotation & { style: "points" };
  #annotationNeedsUpdate = false;

  #cameraModel?: PinholeCameraModel;
  #cameraModelNeedsUpdate = false;

  public constructor(topicName: string) {
    super(topicName, undefined, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId: "",
      pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 0 } },
      settingsPath: [],
      settings: { visible: true },
      topic: topicName,
    });

    this.#geometry = new DynamicBufferGeometry();
    this.#geometry.createAttribute("position", Float32Array, 3);
    this.#geometry.createAttribute("color", Uint8Array, 4, true);
    this.#pointsMaterial = new THREE.PointsMaterial({
      size: 0,
      sizeAttenuation: false,
      vertexColors: true,
      ...annotationRenderOrderMaterialProps,
    });
    this.#pickingMaterial = new PickingMaterial();
    this.#points = new THREE.Points(this.#geometry, this.#pointsMaterial);
    this.#points.renderOrder = ANNOTATION_RENDER_ORDER.POINTS;
    this.#points.userData.pickingMaterial = this.#pickingMaterial;
    this.add(this.#points);
  }

  public override dispose(): void {
    this.#geometry.dispose();
    this.#pointsMaterial.dispose();
    this.#pickingMaterial.dispose();
    super.dispose();
  }

  public override details(): Record<string, RosValue> {
    if (this.#originalMessage && this.#annotation) {
      return {
        annotation: getAnnotationAtPath(this.#originalMessage, this.#annotation.messagePath),
        originalMessage: this.#originalMessage,
      };
    }
    return {};
  }

  public setScale(
    scale: number,
    _canvasWidth: number,
    _canvasHeight: number,
    pixelRatio: number,
  ): void {
    this.#scaleNeedsUpdate ||= scale !== this.#scale || pixelRatio !== this.#pixelRatio;
    this.#scale = scale;
    this.#pixelRatio = pixelRatio;
  }

  public setCameraModel(cameraModel: PinholeCameraModel | undefined): void {
    this.#cameraModelNeedsUpdate ||= this.#cameraModel !== cameraModel;
    this.#cameraModel = cameraModel;
  }

  public setAnnotation(
    annotation: NormalizedPointsAnnotation & { style: "points" },
    originalMessage: RosObject | undefined,
  ): void {
    this.#annotationNeedsUpdate ||= this.#annotation !== annotation;
    this.#originalMessage = originalMessage;
    this.#annotation = annotation;
  }

  public update(): void {
    if (!this.#annotation || !this.#cameraModel) {
      this.visible = false;
      return;
    }
    this.visible = true;

    if (this.#annotationNeedsUpdate || this.#scaleNeedsUpdate) {
      this.#scaleNeedsUpdate = false;
      const { thickness } = this.#annotation;
      // thickness specifies radius, PointsMaterial.size specifies diameter
      this.#pointsMaterial.size = thickness * 2 * this.#scale;
      this.#pointsMaterial.needsUpdate = true;
      // PointsMaterial automatically adjusts for pixel ratio, ShaderMaterial does not
      this.#pickingMaterial.uniforms.size!.value = thickness * 2 * this.#scale * this.#pixelRatio;
      this.#pickingMaterial.needsUpdate = true;
    }

    if (this.#annotationNeedsUpdate || this.#cameraModelNeedsUpdate) {
      this.#annotationNeedsUpdate = false;
      this.#cameraModelNeedsUpdate = false;
      const { points, outlineColors, outlineColor, fillColor } = this.#annotation;
      this.#geometry.resize(points.length);
      const positionAttribute = this.#geometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttribute = this.#geometry.getAttribute("color") as THREE.BufferAttribute;
      const positions = positionAttribute.array as Float32Array;
      const colors = colorAttribute.array as Uint8Array;
      const fallbackColor = outlineColor && outlineColor.a > 0 ? outlineColor : fillColor;

      for (let i = 0; i < points.length; i++) {
        const color = outlineColors[i] ?? fallbackColor;
        const point = points[i]!;

        this.#cameraModel.projectPixelTo3dPlane(tempVec3, point);

        positions[i * 3 + 0] = tempVec3.x;
        positions[i * 3 + 1] = tempVec3.y;
        positions[i * 3 + 2] = tempVec3.z;
        colors[i * 4 + 0] = SRGBToLinear(color?.r ?? 0) * 255;
        colors[i * 4 + 1] = SRGBToLinear(color?.g ?? 0) * 255;
        colors[i * 4 + 2] = SRGBToLinear(color?.b ?? 0) * 255;
        colors[i * 4 + 3] = (color?.a ?? 0) * 255;
      }
      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
    }
  }
}
