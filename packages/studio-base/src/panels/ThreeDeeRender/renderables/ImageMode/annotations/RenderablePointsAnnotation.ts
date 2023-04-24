// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { PinholeCameraModel } from "@foxglove/den/image";
import { PointsAnnotation as NormalizedPointsAnnotation } from "@foxglove/studio-base/panels/Image/types";

import { DynamicBufferGeometry } from "../../../DynamicBufferGeometry";
import { BaseUserData, Renderable } from "../../../Renderable";
import { SRGBToLinear } from "../../../color";

const tempVec3 = new THREE.Vector3();

/**
 * 2D points annotation with style=points (points rendered as dots).
 */
export class RenderablePointsAnnotation extends Renderable<BaseUserData, /*TRenderer=*/ undefined> {
  #geometry: DynamicBufferGeometry;
  #points: THREE.Points;
  #pointsMaterial: THREE.PointsMaterial;

  #scale = 0;
  #scaleNeedsUpdate = false;

  #annotation?: NormalizedPointsAnnotation & { style: "points" };
  #annotationNeedsUpdate = false;

  #cameraModel?: PinholeCameraModel;
  #cameraModelNeedsUpdate = false;

  public constructor() {
    super("foxglove.ImageAnnotations.Points", undefined, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId: "",
      pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 0 } },
      settingsPath: [],
      settings: { visible: true },
    });

    this.#geometry = new DynamicBufferGeometry();
    this.#geometry.createAttribute("position", Float32Array, 3);
    this.#geometry.createAttribute("color", Uint8Array, 4, true);
    this.#pointsMaterial = new THREE.PointsMaterial({
      size: 0,
      sizeAttenuation: false,
      vertexColors: true,
    });
    this.#points = new THREE.Points(this.#geometry, this.#pointsMaterial);
    this.add(this.#points);
  }

  public override dispose(): void {
    this.#geometry.dispose();
    this.#pointsMaterial.dispose();
    super.dispose();
  }

  public setScale(scale: number, _canvasWidth: number, _canvasHeight: number): void {
    this.#scaleNeedsUpdate ||= scale !== this.#scale;
    this.#scale = scale;
  }

  public setCameraModel(cameraModel: PinholeCameraModel | undefined): void {
    this.#cameraModelNeedsUpdate ||= this.#cameraModel !== cameraModel;
    this.#cameraModel = cameraModel;
  }

  public setAnnotation(annotation: NormalizedPointsAnnotation & { style: "points" }): void {
    this.#annotationNeedsUpdate ||= this.#annotation !== annotation;
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
        if (this.#cameraModel.projectPixelTo3dPlane(tempVec3, point)) {
          positions[i * 3 + 0] = tempVec3.x;
          positions[i * 3 + 1] = tempVec3.y;
          positions[i * 3 + 2] = tempVec3.z;
          colors[i * 4 + 0] = SRGBToLinear(color?.r ?? 0) * 255;
          colors[i * 4 + 1] = SRGBToLinear(color?.g ?? 0) * 255;
          colors[i * 4 + 2] = SRGBToLinear(color?.b ?? 0) * 255;
          colors[i * 4 + 3] = (color?.a ?? 0) * 255;
        } else {
          positions[i * 3 + 0] = NaN;
          positions[i * 3 + 1] = NaN;
          positions[i * 3 + 2] = NaN;
        }
      }
      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
    }
  }
}
