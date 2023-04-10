// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry";

import { toNanoSec } from "@foxglove/rostime";
import { LinePrimitive, LineType, SceneEntity } from "@foxglove/schemas";
import { LineMaterial } from "@foxglove/studio-base/panels/ThreeDeeRender/LineMaterial";

import { RenderablePrimitive } from "./RenderablePrimitive";
import type { IRenderer } from "../../IRenderer";
import { makeRgba, rgbToThreeColor, SRGBToLinear, stringToRgba } from "../../color";
import { LayerSettingsEntity } from "../../settings";

const tempRgba = makeRgba();

export class RenderableLines extends RenderablePrimitive {
  private _lines: LineSegments2[] = [];
  public constructor(renderer: IRenderer) {
    super("", renderer);
  }

  private _updateLines(lines: LinePrimitive[]) {
    this.clear();
    this._lines.length = 0;

    for (const primitive of lines) {
      if (primitive.points.length === 0) {
        continue;
      }
      const line = this._makeLine(primitive);
      const group = new THREE.Group().add(line);
      group.position.set(
        primitive.pose.position.x,
        primitive.pose.position.y,
        primitive.pose.position.z,
      );
      group.quaternion.set(
        primitive.pose.orientation.x,
        primitive.pose.orientation.y,
        primitive.pose.orientation.z,
        primitive.pose.orientation.w,
      );
      this.add(group);
      this._lines.push(line);
    }
  }

  private _makeLine(primitive: LinePrimitive) {
    let geometry: LineSegmentsGeometry;
    const isSegments = primitive.type === LineType.LINE_LIST;
    const isLoop = primitive.type === LineType.LINE_LOOP;

    const transparent = true;
    const material = new LineMaterial({
      worldUnits: !primitive.scale_invariant,
      linewidth: primitive.thickness,
      transparent,
      depthWrite: !transparent,
      resolution: this.renderer.input.canvasSize,
    });
    material.lineWidth = primitive.thickness; // Fix for THREE.js type annotations

    const pickingMaterial = new THREE.ShaderMaterial({
      vertexShader: material.vertexShader,
      fragmentShader: /* glsl */ `
      uniform vec4 objectId;
      void main() {
        gl_FragColor = objectId;
      }
    `,
      clipping: true,
      uniforms: {
        objectId: { value: [NaN, NaN, NaN, NaN] },
        linewidth: { value: primitive.thickness },
        resolution: { value: this.renderer.input.canvasSize },
        dashOffset: { value: 0 },
        dashScale: { value: 1 },
        dashSize: { value: 1 },
        gapSize: { value: 1 },
      },
      defines: !primitive.scale_invariant ? { WORLD_UNITS: "" } : {},
    });

    let line: LineSegments2;

    switch (primitive.type) {
      case LineType.LINE_STRIP:
      case LineType.LINE_LOOP: {
        const lineGeometry = new LineGeometry(); // separate variable to work around typescript refinement
        geometry = lineGeometry;
        line = new Line2(lineGeometry, material);
        break;
      }
      case LineType.LINE_LIST: {
        geometry = new LineSegmentsGeometry();
        line = new LineSegments2(geometry, material);
        break;
      }
    }

    const positions = getPositions(primitive);
    // setPosition requires the position array to be >= 6 length or else it will error
    // we skip primitives with empty points before calling this function
    geometry.setPositions(positions);

    const singleColor = this.userData.settings.color
      ? stringToRgba(tempRgba, this.userData.settings.color)
      : primitive.colors.length === 0
      ? primitive.color
      : undefined;
    if (singleColor == undefined) {
      material.vertexColors = true;
      material.opacity = 1;
      material.uniforms.opacity!.value = 1;
      const colors = getColors(primitive);
      const instanceColorBuffer = new THREE.InstancedInterleavedBuffer(
        colors,
        isSegments ? 8 : 4,
        1,
      );
      geometry.setAttribute(
        "instanceColorStart",
        new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 0),
      );
      geometry.setAttribute(
        "instanceColorEnd",
        new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 4),
      );
    } else {
      material.vertexColors = false;
      material.color = rgbToThreeColor(new THREE.Color(), singleColor);
      // material.opacity = singleColor.a; // does not work for some reason
      material.uniforms.opacity!.value = singleColor.a;
    }

    // Set an explicit instance count, because three.js ignores attribute offsets when
    // automatically computing the instance count (and results differ across browsers because they
    // depend on the key iteration order, since three.js derives the count from the first
    // instanced interleaved attribute it sees).
    geometry.instanceCount = isSegments
      ? primitive.points.length >>> 1
      : isLoop
      ? primitive.points.length
      : Math.max(primitive.points.length - 1, 0);

    line.userData.pickingMaterial = pickingMaterial;
    return line;
  }

  public override dispose(): void {
    for (const line of this._lines) {
      line.geometry.dispose();
      line.material.dispose();
      line.userData.pickingMaterial.dispose();
    }
  }

  public override update(
    topic: string | undefined,
    entity: SceneEntity | undefined,
    settings: LayerSettingsEntity,
    receiveTime: bigint,
  ): void {
    super.update(topic, entity, settings, receiveTime);
    if (entity) {
      const lifetimeNs = toNanoSec(entity.lifetime);
      this.userData.expiresAt = lifetimeNs === 0n ? undefined : receiveTime + lifetimeNs;
      this._updateLines(entity.lines);
    }
  }

  public updateSettings(settings: LayerSettingsEntity): void {
    this.update(this.userData.topic, this.userData.entity, settings, this.userData.receiveTime);
  }
}

/**
 * Converts (x,y,z) values specified in `primitive.points` (and possibly `primitive.indices`) into
 * vertices for LineGeometry or LineSegmentsGeometry.
 */
function getPositions(primitive: LinePrimitive): Float32Array {
  const isLoop = primitive.type === LineType.LINE_LOOP;
  let positions: Float32Array;
  const indices = primitive.indices;
  if (indices.length > 0) {
    positions = new Float32Array((indices.length + (isLoop ? 1 : 0)) * 3);

    let i = 0;
    for (const idx of indices) {
      const { x, y, z } = primitive.points[idx]!;
      positions[i++] = x;
      positions[i++] = y;
      positions[i++] = z;
    }
  } else {
    positions = new Float32Array((primitive.points.length + (isLoop ? 1 : 0)) * 3);

    let i = 0;
    for (const { x, y, z } of primitive.points) {
      positions[i++] = x;
      positions[i++] = y;
      positions[i++] = z;
    }
  }
  if (isLoop && positions.length > 3) {
    positions[positions.length - 3] = positions[0]!;
    positions[positions.length - 2] = positions[1]!;
    positions[positions.length - 1] = positions[2]!;
  }
  return positions;
}

/**
 * Converts RGBA colors specified in `primitive.colors` (and possibly `primitive.indices`) into
 * vertices for LineGeometry or LineSegmentsGeometry.
 */
function getColors(primitive: LinePrimitive): Float32Array {
  const isLoop = primitive.type === LineType.LINE_LOOP;
  let colors: Float32Array;
  const indices = primitive.indices;
  if (indices.length > 0) {
    colors = new Float32Array((indices.length + (isLoop ? 1 : 0)) * 4);

    if (primitive.colors.length > 0) {
      let i = 0;
      for (const idx of indices) {
        const { r, g, b, a } = primitive.colors[idx]!;
        colors[i++] = SRGBToLinear(r);
        colors[i++] = SRGBToLinear(g);
        colors[i++] = SRGBToLinear(b);
        colors[i++] = a;
      }
    } else {
      throw new Error("invariant: expected not to be using vertex colors");
    }
  } else {
    colors = new Float32Array((primitive.points.length + (isLoop ? 1 : 0)) * 4);

    if (primitive.colors.length > 0) {
      let i = 0;
      for (const { r, g, b, a } of primitive.colors) {
        colors[i++] = SRGBToLinear(r);
        colors[i++] = SRGBToLinear(g);
        colors[i++] = SRGBToLinear(b);
        colors[i++] = a;
      }
    } else {
      throw new Error("invariant: expected not to be using vertex colors");
    }
  }
  if (isLoop && colors.length > 4) {
    colors[colors.length - 4] = colors[0]!;
    colors[colors.length - 3] = colors[1]!;
    colors[colors.length - 2] = colors[2]!;
    colors[colors.length - 1] = colors[3]!;
  }
  return colors;
}
