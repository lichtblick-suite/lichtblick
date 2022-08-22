// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { DynamicBufferGeometry, DynamicFloatBufferGeometry } from "../../DynamicBufferGeometry";
import type { Renderer } from "../../Renderer";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { markerHasTransparency, makePointsMaterial } from "./materials";

export class RenderablePoints extends RenderableMarker {
  private geometry: DynamicFloatBufferGeometry;
  private points: THREE.Points<DynamicFloatBufferGeometry, THREE.PointsMaterial>;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: Renderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    this.geometry = new DynamicBufferGeometry(Float32Array);
    this.geometry.createAttribute("position", 3);
    this.geometry.createAttribute("color", 4);

    this.points = new THREE.Points(this.geometry, makePointsMaterial(marker));
    this.add(this.points);

    this.update(marker, receiveTime);
  }

  public override dispose(): void {
    this.points.material.dispose();
  }

  public override update(newMarker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(newMarker, receiveTime);
    const marker = this.userData.marker;

    const transparent = markerHasTransparency(marker);
    if (transparent !== markerHasTransparency(prevMarker)) {
      this.points.material.transparent = transparent;
      this.points.material.depthWrite = !transparent;
      this.points.material.needsUpdate = true;
    }

    this.points.material.size = marker.scale.x;

    const pointsLength = marker.points.length;
    this.geometry.resize(pointsLength);
    this._setPositions(marker, pointsLength);
    this._setColors(marker, pointsLength);
  }

  private _setPositions(marker: Marker, pointsLength: number): void {
    const attribute = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const positions = attribute.array as Float32Array;
    for (let i = 0; i < pointsLength; i++) {
      const point = marker.points[i]!;
      positions[i * 3 + 0] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    }
    attribute.needsUpdate = true;
  }

  private _setColors(marker: Marker, pointsLength: number): void {
    // Converts color-per-point to a flattened typed array
    const attribute = this.geometry.getAttribute("color") as THREE.BufferAttribute;
    const rgbaData = attribute.array as Float32Array;
    this._markerColorsToLinear(marker, pointsLength, (color, i) => {
      rgbaData[4 * i + 0] = color[0];
      rgbaData[4 * i + 1] = color[1];
      rgbaData[4 * i + 2] = color[2];
      rgbaData[4 * i + 3] = color[3];
    });
    attribute.needsUpdate = true;
  }
}
