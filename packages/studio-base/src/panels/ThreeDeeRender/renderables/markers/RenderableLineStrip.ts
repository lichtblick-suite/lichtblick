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
import { LineMaterial } from "../../LineMaterial";
import { Marker } from "../../ros";

export class RenderableLineStrip extends RenderableMarker {
  private geometry: LineGeometry;
  private linePrepass: Line2;
  private line: Line2;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: IRenderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    this.geometry = new LineGeometry();

    const options = { resolution: renderer.input.canvasSize, worldUnits: true };

    // We alleviate corner artifacts using a two-pass render for lines. The
    // first pass writes to depth only, followed by a color pass with stencil
    // operations. The source for this technique is:
    // <https://github.com/mrdoob/three.js/issues/23680#issuecomment-1063294691>
    // <https://gkjohnson.github.io/threejs-sandbox/fat-line-opacity/webgl_lines_fat.html>

    // Depth pass 1
    const matLinePrepass = makeLinePrepassMaterial(marker, options);
    this.linePrepass = new Line2(this.geometry, matLinePrepass);
    this.linePrepass.renderOrder = 1;
    this.linePrepass.userData.picking = false;
    this.add(this.linePrepass);

    // Color pass 2
    const matLine = makeLineMaterial(marker, options);
    this.line = new Line2(this.geometry, matLine);
    this.line.renderOrder = 2;
    const pickingLineWidth = marker.scale.x * 1.2;
    this.line.userData.pickingMaterial = makeLinePickingMaterial(pickingLineWidth, options);
    this.add(this.line);

    this.update(marker, receiveTime);
  }

  public override dispose(): void {
    this.linePrepass.material.dispose();
    this.line.material.dispose();

    const pickingMaterial = this.line.userData.pickingMaterial as THREE.ShaderMaterial;
    pickingMaterial.dispose();
    this.line.userData.pickingMaterial = undefined;

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
      this.linePrepass.visible = false;
      this.line.visible = false;
      return;
    } else {
      this.linePrepass.visible = true;
      this.line.visible = true;
    }

    if (transparent !== markerHasTransparency(prevMarker)) {
      this.linePrepass.material.transparent = transparent;
      this.linePrepass.material.depthWrite = !transparent;
      this.linePrepass.material.needsUpdate = true;
      this.line.material.transparent = transparent;
      this.line.material.depthWrite = !transparent;
      this.line.material.needsUpdate = true;
    }

    const matLinePrepass = this.linePrepass.material as LineMaterial;
    matLinePrepass.lineWidth = lineWidth;
    const matLine = this.line.material as LineMaterial;
    matLine.lineWidth = lineWidth;

    const prevPointsLength = (this.geometry.attributes.instanceStart?.count ?? 0) * 2;
    if (pointsLength !== prevPointsLength) {
      this.geometry.dispose();
      this.geometry = new LineGeometry();
      this.linePrepass.geometry = this.geometry;
      this.line.geometry = this.geometry;
    }

    this._setPositions(marker, pointsLength);
    this._setColors(marker, pointsLength);

    this.linePrepass.computeLineDistances();
    this.line.computeLineDistances();
  }

  private _setPositions(marker: Marker, pointsLength: number): void {
    const linePositions = new Float32Array(3 * pointsLength);
    for (let i = 0; i < pointsLength; i++) {
      const point = marker.points[i]!;
      const offset = i * 3;
      linePositions[offset + 0] = point.x;
      linePositions[offset + 1] = point.y;
      linePositions[offset + 2] = point.z;
    }

    this.geometry.setPositions(linePositions);
  }

  private _setColors(marker: Marker, pointsLength: number): void {
    // Converts color-per-point to pairs format in a flattened typed array
    const rgbaData = new Float32Array(8 * pointsLength);
    const color1: THREE.Vector4Tuple = [0, 0, 0, 0];
    this._markerColorsToLinear(marker, pointsLength, (color2, ii) => {
      if (ii === 0) {
        copyTuple4(color2, color1);
        return;
      }
      const i = ii - 1;
      const offset = i * 8;

      rgbaData[offset + 0] = color1[0];
      rgbaData[offset + 1] = color1[1];
      rgbaData[offset + 2] = color1[2];
      rgbaData[offset + 3] = color1[3];

      rgbaData[offset + 4] = color2[0];
      rgbaData[offset + 5] = color2[1];
      rgbaData[offset + 6] = color2[2];
      rgbaData[offset + 7] = color2[3];

      copyTuple4(color2, color1);
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

function copyTuple4(from: THREE.Vector4Tuple, to: THREE.Vector4Tuple): void {
  to[0] = from[0];
  to[1] = from[1];
  to[2] = from[2];
  to[3] = from[3];
}
