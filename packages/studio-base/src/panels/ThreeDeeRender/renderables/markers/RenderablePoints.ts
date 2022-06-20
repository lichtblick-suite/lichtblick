// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { DynamicBufferGeometry } from "../../DynamicBufferGeometry";
import type { Renderer } from "../../Renderer";
import { approxEquals } from "../../math";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { markerHasTransparency, pointsMaterial, releasePointsMaterial } from "./materials";

export class RenderablePoints extends RenderableMarker {
  geometry: DynamicBufferGeometry<Float32Array, Float32ArrayConstructor>;
  points: THREE.Points;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    this.geometry = new DynamicBufferGeometry(Float32Array);
    this.geometry.createAttribute("position", 3);
    this.geometry.createAttribute("color", 4);

    const material = pointsMaterial(marker, renderer.materialCache);
    this.points = new THREE.Points(this.geometry, material);
    this.add(this.points);

    this.update(marker, receiveTime);
  }

  override dispose(): void {
    releasePointsMaterial(this.userData.marker, this.renderer.materialCache);
  }

  override update(marker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    const prevWidth = prevMarker.scale.x;
    const prevHeight = prevMarker.scale.y;
    const prevTransparent = markerHasTransparency(prevMarker);
    const width = marker.scale.x;
    const height = marker.scale.y;
    const transparent = markerHasTransparency(marker);

    if (
      !approxEquals(prevWidth, width) ||
      !approxEquals(prevHeight, height) ||
      prevTransparent !== transparent
    ) {
      releasePointsMaterial(prevMarker, this.renderer.materialCache);
      this.points.material = pointsMaterial(marker, this.renderer.materialCache);
    }

    this.geometry.resize(marker.points.length);
    this._setPositions(marker);
    this._setColors(marker);
  }

  private _setPositions(marker: Marker): void {
    const attribute = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const positions = attribute.array as Float32Array;
    for (let i = 0; i < marker.points.length; i++) {
      const point = marker.points[i]!;
      positions[i * 3 + 0] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    }
    attribute.needsUpdate = true;
  }

  private _setColors(marker: Marker): void {
    // Converts color-per-point to a flattened typed array
    const attribute = this.geometry.getAttribute("color") as THREE.BufferAttribute;
    const rgbaData = attribute.array as Float32Array;
    this._markerColorsToLinear(marker, (color, i) => {
      rgbaData[4 * i + 0] = color[0];
      rgbaData[4 * i + 1] = color[1];
      rgbaData[4 * i + 2] = color[2];
      rgbaData[4 * i + 3] = color[3];
    });
    attribute.needsUpdate = true;
  }
}
