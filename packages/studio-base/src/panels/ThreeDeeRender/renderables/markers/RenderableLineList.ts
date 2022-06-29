// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry";

import type { Renderer } from "../../Renderer";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import {
  makeLineMaterial,
  makeLinePrepassMaterial,
  makeLinePickingMaterial,
  markerHasTransparency,
} from "./materials";

export class RenderableLineList extends RenderableMarker {
  geometry: LineSegmentsGeometry;
  linePrepass: LineSegments2;
  line: LineSegments2;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    this.geometry = new LineSegmentsGeometry();

    // Stencil and depth pass 1
    const matLinePrepass = makeLinePrepassMaterial(marker);
    this.linePrepass = new LineSegments2(this.geometry, matLinePrepass);
    this.linePrepass.renderOrder = 1;
    this.linePrepass.userData.picking = false;
    this.add(this.linePrepass);

    // Color pass 2
    const matLine = makeLineMaterial(marker);
    this.line = new LineSegments2(this.geometry, matLine);
    this.line.renderOrder = 2;
    const pickingLineWidth = marker.scale.x * 1.2;
    this.line.userData.pickingMaterial = makeLinePickingMaterial(pickingLineWidth, true);
    this.add(this.line);

    this.update(marker, receiveTime);
  }

  override dispose(): void {
    this.linePrepass.material.dispose();
    this.line.material.dispose();

    const pickingMaterial = this.line.userData.pickingMaterial as THREE.ShaderMaterial;
    pickingMaterial.dispose();

    this.geometry.dispose();
  }

  override update(marker: Marker, receiveTime: bigint | undefined): void {
    let pointsLength = marker.points.length;
    if (pointsLength % 2 !== 0) {
      pointsLength--;
    }

    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    const lineWidth = marker.scale.x;
    const transparent = markerHasTransparency(marker);

    if (transparent !== markerHasTransparency(prevMarker)) {
      this.linePrepass.material.transparent = transparent;
      this.linePrepass.material.depthWrite = !transparent;
      this.linePrepass.material.needsUpdate = true;
      this.line.material.transparent = transparent;
      this.line.material.depthWrite = !transparent;
      this.line.material.needsUpdate = true;
    }

    this.linePrepass.material.linewidth = lineWidth;
    this.line.material.linewidth = lineWidth;

    this._setPositions(marker, pointsLength);
    this._setColors(marker, pointsLength);

    // These both update the same `LineSegmentsGeometry` reference, so no need to call both
    // this.linePrepass.computeLineDistances();
    this.line.computeLineDistances();
  }

  private _setPositions(marker: Marker, pointsLength: number): void {
    const linePositions = new Float32Array(3 * pointsLength);
    for (let i = 0; i < pointsLength; i++) {
      const point = marker.points[i]!;
      linePositions[i * 3 + 0] = point.x;
      linePositions[i * 3 + 1] = point.y;
      linePositions[i * 3 + 2] = point.z;
    }

    this.geometry.setPositions(linePositions);
  }

  private _setColors(marker: Marker, pointsLength: number): void {
    // Converts color-per-point to a flattened typed array
    const rgbaData = new Float32Array(4 * pointsLength);
    this._markerColorsToLinear(marker, pointsLength, (color, i) => {
      rgbaData[4 * i + 0] = color[0];
      rgbaData[4 * i + 1] = color[1];
      rgbaData[4 * i + 2] = color[2];
      rgbaData[4 * i + 3] = color[3];
    });

    // [rgba, rgba]
    const instanceColorBuffer = new THREE.InstancedInterleavedBuffer(rgbaData, 8, 1);
    this.geometry.setAttribute(
      "instanceColorStart",
      new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 0),
    );
    this.geometry.setAttribute(
      "instanceColorEnd",
      new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 4),
    );
  }
}
