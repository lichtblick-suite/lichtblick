// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";

import { RenderableMarker } from "./RenderableMarker";
import {
  makeLineMaterial,
  makeLinePrepassMaterial,
  makeLinePickingMaterial,
  markerHasTransparency,
} from "./materials";
import type { IRenderer } from "../../IRenderer";
import { LineMaterialWithAlphaVertex } from "../../LineMaterialWithAlphaVertex";
import { Marker } from "../../ros";

const tempTuple4: THREE.Vector4Tuple = [0, 0, 0, 0];

export class RenderableLineStrip extends RenderableMarker {
  #geometry: LineGeometry;
  #linePrepass: Line2;
  #line: Line2;
  #positionBuffer = new Float32Array();
  #colorBuffer = new Uint8Array();

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: IRenderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    this.#geometry = new LineGeometry();

    const options = { resolution: renderer.input.canvasSize, worldUnits: true };

    // We alleviate corner artifacts using a two-pass render for lines. The
    // first pass writes to depth only, followed by a color pass with stencil
    // operations. The source for this technique is:
    // <https://github.com/mrdoob/three.js/issues/23680#issuecomment-1063294691>
    // <https://gkjohnson.github.io/threejs-sandbox/fat-line-opacity/webgl_lines_fat.html>

    // Depth pass 1
    const matLinePrepass = makeLinePrepassMaterial(marker, options);
    this.#linePrepass = new Line2(this.#geometry, matLinePrepass);
    this.#linePrepass.renderOrder = 1;
    this.#linePrepass.userData.picking = false;
    this.add(this.#linePrepass);

    // Color pass 2
    const matLine = makeLineMaterial(marker, options);
    this.#line = new Line2(this.#geometry, matLine);
    this.#line.renderOrder = 2;
    const pickingLineWidth = marker.scale.x * 1.2;
    this.#line.userData.pickingMaterial = makeLinePickingMaterial(pickingLineWidth, options);
    this.add(this.#line);

    this.update(marker, receiveTime);
  }

  public override dispose(): void {
    this.#linePrepass.material.dispose();
    this.#line.material.dispose();

    const pickingMaterial = this.#line.userData.pickingMaterial as THREE.ShaderMaterial;
    pickingMaterial.dispose();
    this.#line.userData.pickingMaterial = undefined;

    super.dispose();
  }

  public override update(newMarker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(newMarker, receiveTime);
    const marker = this.userData.marker;

    const pointsLength = marker.points.length;
    const lineWidth = marker.scale.x;
    const transparent = markerHasTransparency(marker);

    if (pointsLength === 0) {
      // THREE.LineGeometry.setPositions crashes when given an empty array:
      // https://github.com/foxglove/studio/issues/3954
      this.#linePrepass.visible = false;
      this.#line.visible = false;
      return;
    } else {
      this.#linePrepass.visible = true;
      this.#line.visible = true;
    }

    if (transparent !== markerHasTransparency(prevMarker)) {
      this.#linePrepass.material.transparent = transparent;
      this.#linePrepass.material.depthWrite = !transparent;
      this.#linePrepass.material.needsUpdate = true;
      this.#line.material.transparent = transparent;
      this.#line.material.depthWrite = !transparent;
      this.#line.material.needsUpdate = true;
    }

    const matLinePrepass = this.#linePrepass.material as LineMaterialWithAlphaVertex;
    matLinePrepass.lineWidth = lineWidth;
    const matLine = this.#line.material as LineMaterialWithAlphaVertex;
    matLine.lineWidth = lineWidth;

    const prevPointsLength = this.#positionBuffer.length / 3;
    if (pointsLength > prevPointsLength) {
      this.#geometry.dispose();
      this.#geometry = new LineGeometry();
      this.#linePrepass.geometry = this.#geometry;
      this.#line.geometry = this.#geometry;
    }

    this.#setPositions(marker, pointsLength);
    this.#setColors(marker, pointsLength);

    this.#linePrepass.computeLineDistances();
    this.#line.computeLineDistances();
  }

  #setPositions(marker: Marker, pointsLength: number): void {
    if (3 * pointsLength > this.#positionBuffer.length) {
      this.#positionBuffer = new Float32Array(3 * pointsLength);
    }
    const positions = this.#positionBuffer;
    for (let i = 0; i < pointsLength; i++) {
      const point = marker.points[i]!;
      const offset = i * 3;
      positions[offset + 0] = point.x;
      positions[offset + 1] = point.y;
      positions[offset + 2] = point.z;
    }

    this.#geometry.setPositions(positions);
    this.#geometry.instanceCount = pointsLength - 1;
  }

  #setColors(marker: Marker, pointsLength: number): void {
    // Converts color-per-point to pairs format in a flattened typed array
    if (8 * pointsLength > this.#colorBuffer.length) {
      this.#colorBuffer = new Uint8Array(8 * pointsLength);
      // [rgba, rgba]
      const instanceColorBuffer = new THREE.InstancedInterleavedBuffer(this.#colorBuffer, 8, 1);
      this.#geometry.setAttribute(
        "instanceColorStart",
        new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 0, true),
      );
      this.#geometry.setAttribute(
        "instanceColorEnd",
        new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 4, true),
      );
    } else {
      this.#geometry.getAttribute("instanceColorStart").needsUpdate = true;
      this.#geometry.getAttribute("instanceColorEnd").needsUpdate = true;
    }

    const colorBuffer = this.#colorBuffer;
    const color1: THREE.Vector4Tuple = tempTuple4;
    color1[0] = 0;
    color1[1] = 0;
    color1[2] = 0;
    color1[3] = 0;
    this._markerColorsToLinear(marker, pointsLength, (color2, ii) => {
      if (ii === 0) {
        copyTuple4(color2, color1);
        return;
      }
      const i = ii - 1;
      const offset = i * 8;

      colorBuffer[offset + 0] = Math.floor(255 * color1[0]);
      colorBuffer[offset + 1] = Math.floor(255 * color1[1]);
      colorBuffer[offset + 2] = Math.floor(255 * color1[2]);
      colorBuffer[offset + 3] = Math.floor(255 * color1[3]);

      colorBuffer[offset + 4] = Math.floor(255 * color2[0]);
      colorBuffer[offset + 5] = Math.floor(255 * color2[1]);
      colorBuffer[offset + 6] = Math.floor(255 * color2[2]);
      colorBuffer[offset + 7] = Math.floor(255 * color2[3]);

      copyTuple4(color2, color1);
    });
  }
}

function copyTuple4(from: THREE.Vector4Tuple, to: THREE.Vector4Tuple): void {
  to[0] = from[0];
  to[1] = from[1];
  to[2] = from[2];
  to[3] = from[3];
}
