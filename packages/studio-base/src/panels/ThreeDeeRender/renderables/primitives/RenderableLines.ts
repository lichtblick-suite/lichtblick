// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry";
import { assert } from "ts-essentials";

import { toNanoSec } from "@foxglove/rostime";
import { LinePrimitive, LineType, SceneEntity } from "@foxglove/schemas";
import { LineMaterialWithAlphaVertex } from "@foxglove/studio-base/panels/ThreeDeeRender/LineMaterialWithAlphaVertex";

import { RenderablePrimitive } from "./RenderablePrimitive";
import type { IRenderer } from "../../IRenderer";
import { makeRgba, rgbToThreeColor, SRGBToLinear, stringToRgba } from "../../color";
import { LayerSettingsEntity } from "../../settings";

const tempRgba = makeRgba();

export class RenderableLines extends RenderablePrimitive {
  #lines: LinePrimitiveRenderable[] = [];
  public constructor(renderer: IRenderer) {
    super("", renderer);
  }

  #updateLines(lines: LinePrimitive[]) {
    this.clear();

    let idx = 0;
    for (idx; idx < lines.length; idx++) {
      const primitive = lines[idx]!;
      if (primitive.points.length === 0) {
        continue;
      }
      let lineRenderable = this.#lines[idx];
      if (lineRenderable == undefined) {
        lineRenderable = new LinePrimitiveRenderable(primitive, this.renderer.input.canvasSize);
        this.#lines.push(lineRenderable);
      }
      lineRenderable.setPrimitive(primitive);
      lineRenderable.setSettings(this.userData.settings);

      lineRenderable.update();

      lineRenderable.position.set(
        primitive.pose.position.x,
        primitive.pose.position.y,
        primitive.pose.position.z,
      );
      lineRenderable.quaternion.set(
        primitive.pose.orientation.x,
        primitive.pose.orientation.y,
        primitive.pose.orientation.z,
        primitive.pose.orientation.w,
      );
      this.add(lineRenderable);
    }
  }

  public override dispose(): void {
    for (const line of this.#lines) {
      line.dispose();
      line.removeFromParent();
    }
    this.clear();
    this.#lines.length = 0;
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
      this.#updateLines(entity.lines);
    }
  }

  public updateSettings(settings: LayerSettingsEntity): void {
    this.update(this.userData.topic, this.userData.entity, settings, this.userData.receiveTime);
  }
}

class LinePrimitiveRenderable extends THREE.Object3D {
  #geometry: LineSegmentsGeometry | LineGeometry | undefined;
  #positionBuffer: Float32Array | undefined;
  #colorBuffer: Float32Array | undefined;

  #material: LineMaterialWithAlphaVertex;
  #pickingMaterial: PickingMaterial;
  #transparent: boolean = true;
  #line: LineSegments2 | Line2 | undefined;

  #primitiveChanged: boolean = true;
  #primitive?: LinePrimitive;

  // Settings
  #colorChanged: boolean = true;
  #color: string | undefined;

  #lineType: LineType | undefined;

  public constructor(primitive: LinePrimitive, canvasSize: THREE.Vector2) {
    super();

    this.#material = new LineMaterialWithAlphaVertex({
      worldUnits: !primitive.scale_invariant,
      linewidth: primitive.thickness,
      transparent: this.#transparent,
      depthWrite: !this.#transparent,
      resolution: canvasSize.clone(),
    });
    this.#material.linewidth = primitive.thickness; // Fix for THREE.js type annotations

    this.#pickingMaterial = new PickingMaterial();
    this.#pickingMaterial.resolution.set(canvasSize.x, canvasSize.y);
    this.#pickingMaterial.linewidth = primitive.thickness;
    this.#pickingMaterial.worldUnits = !primitive.scale_invariant;
    this.#pickingMaterial.needsUpdate = true;
  }

  public setSettings(settings: LayerSettingsEntity): void {
    this.#colorChanged ||= this.#color !== settings.color;
    this.#color = settings.color;
  }

  public setPrimitive(primitive: LinePrimitive): void {
    this.#primitiveChanged ||= this.#primitive !== primitive;
    this.#primitive = primitive;
  }

  public update(): void {
    if (this.#primitive == undefined) {
      this.visible = false;
      return;
    }
    this.visible = true;
    const isLoop = this.#primitive.type === LineType.LINE_LOOP;
    const isSegments = this.#primitive.type === LineType.LINE_LIST;
    const useIndices = this.#primitive.indices.length > 0;

    const numVertices =
      (useIndices ? this.#primitive.indices.length : this.#primitive.points.length) +
      (isLoop ? 1 : 0);
    const necessaryPositionBufferSize = numVertices * 3;

    if (this.#primitiveChanged) {
      const geometryNeedsRecreated =
        this.#geometry == undefined ||
        this.#lineType !== this.#primitive.type ||
        !this.#positionBuffer ||
        this.#positionBuffer.length < necessaryPositionBufferSize;
      if (geometryNeedsRecreated) {
        if (this.#geometry != undefined) {
          this.#geometry.dispose();
          this.#positionBuffer = undefined;
          this.#colorBuffer = undefined;
        }
        if (this.#line != undefined) {
          this.#line.removeFromParent();
        }

        this.#lineType = this.#primitive.type;
        switch (this.#primitive.type) {
          case LineType.LINE_STRIP:
          case LineType.LINE_LOOP: {
            const lineGeometry = new LineGeometry(); // separate variable to work around typescript refinement
            this.#geometry = lineGeometry;
            this.#positionBuffer = new Float32Array(necessaryPositionBufferSize);
            this.#line = new Line2(lineGeometry, this.#material);
            break;
          }
          case LineType.LINE_LIST: {
            this.#geometry = new LineSegmentsGeometry();
            this.#positionBuffer = new Float32Array(necessaryPositionBufferSize);
            this.#line = new LineSegments2(this.#geometry, this.#material);
            break;
          }
        }
        this.#line.userData.pickingMaterial = this.#pickingMaterial;
        this.userData.pickingMaterial = this.#pickingMaterial;
        this.add(this.#line);
      }

      assert(this.#positionBuffer, "Position buffer must be initialized");
      assert(this.#geometry, "Geometry must be initialized");

      // Set an explicit instance count, because three.js ignores attribute offsets when
      // automatically computing the instance count (and results differ across browsers because they
      // depend on the key iteration order, since three.js derives the count from the first
      // instanced interleaved attribute it sees).
      // this represent the number of _lines_ to render
      this.#geometry.instanceCount = isSegments
        ? numVertices >>> 1
        : isLoop
        ? numVertices
        : Math.max(numVertices - 1, 0);

      if (useIndices) {
        serializePositionsWithIndices(this.#positionBuffer, this.#primitive);
      } else {
        serializePositions(this.#positionBuffer, this.#primitive);
      }

      // setPosition requires the position array to be >= 6 length or else it will error
      // we skip primitives with empty points before calling this function
      this.#geometry.setPositions(this.#positionBuffer);
    }

    if (this.#colorChanged || this.#primitiveChanged) {
      const singleColor = this.#color
        ? stringToRgba(tempRgba, this.#color)
        : this.#primitive.colors.length === 0
        ? this.#primitive.color
        : undefined;

      if (singleColor == undefined) {
        assert(this.#geometry, "Line Group geometry must exist");
        this.#material.color.setRGB(1, 1, 1);

        const necessaryColorBufferSize = numVertices * 4;

        if (this.#colorBuffer == undefined || this.#colorBuffer.length < necessaryColorBufferSize) {
          this.#colorBuffer = new Float32Array(necessaryColorBufferSize);
        }
        this.#material.vertexColors = true;
        (this.#material.color as THREE.Color).setRGB(1, 1, 1); // any non-white color will tint the vertex colors
        this.#material.opacity = 1;
        this.#material.uniforms.opacity!.value = 1;
        if (useIndices) {
          serializeColorsWithIndices(this.#colorBuffer, this.#primitive);
        } else {
          serializeColors(this.#colorBuffer, this.#primitive);
        }
        const instanceColorBuffer = new THREE.InstancedInterleavedBuffer(
          this.#colorBuffer,
          isSegments ? 8 : 4,
          1,
        );
        this.#geometry.setAttribute(
          "instanceColorStart",
          new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 0),
        );
        this.#geometry.setAttribute(
          "instanceColorEnd",
          new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 4),
        );
      } else {
        this.#material.vertexColors = false;
        const color = this.#material.color as THREE.Color;
        rgbToThreeColor(color, singleColor);
        this.#material.setOpacity(singleColor.a);
      }

      this.#updateMaterial();
    }

    this.#primitiveChanged = false;
    this.#colorChanged = false;
  }

  #updateMaterial() {
    if (this.#primitive == undefined) {
      return;
    }
    this.#material.lineWidth = this.#primitive.thickness;
    this.#material.transparent = this.#transparent;
    this.#material.worldUnits = !this.#primitive.scale_invariant;
    this.#material.needsUpdate = true;

    this.#pickingMaterial.lineWidth = this.#primitive.thickness;
    this.#pickingMaterial.worldUnits = !this.#primitive.scale_invariant;
    this.#pickingMaterial.uniformsNeedUpdate = true;
    this.#pickingMaterial.needsUpdate = true;
  }

  public dispose(): void {
    this.#line?.removeFromParent();
    this.#geometry?.dispose();
    this.#material.dispose();
    this.#pickingMaterial.dispose();
  }
}

function serializePositions(positionsOut: Float32Array, primitive: LinePrimitive): void {
  let i = 0;
  assert(
    positionsOut.length >= primitive.points.length * 3,
    `positionsOut must have a length (${positionsOut.length})  >= to primitive.points.length (${primitive.points.length}) * 3`,
  );
  for (const { x, y, z } of primitive.points) {
    positionsOut[i++] = x;
    positionsOut[i++] = y;
    positionsOut[i++] = z;
  }

  const isLoop = primitive.type === LineType.LINE_LOOP;
  if (isLoop && positionsOut.length > 3) {
    positionsOut.copyWithin(i, 0, 3);
  }
}

function serializePositionsWithIndices(positionsOut: Float32Array, primitive: LinePrimitive): void {
  const indices = primitive.indices;
  assert(
    positionsOut.length >= primitive.indices.length * 3,
    `positionsOut must have a length (${positionsOut.length})  >= to primitive.indices.length (${primitive.indices.length}) * 3`,
  );
  let i = 0;
  for (const idx of indices) {
    const { x, y, z } = primitive.points[idx]!;
    positionsOut[i++] = x;
    positionsOut[i++] = y;
    positionsOut[i++] = z;
  }

  const isLoop = primitive.type === LineType.LINE_LOOP;
  if (isLoop && positionsOut.length > 3) {
    positionsOut.copyWithin(i, 0, 3);
  }
}

function serializeColors(colorsOut: Float32Array, primitive: LinePrimitive): void {
  assert(
    colorsOut.length >= primitive.colors.length * 4,
    `colorsOut buffer must have a length (${colorsOut.length}) >= to the primitive.colors.length (${primitive.colors.length}) * 4`,
  );
  assert(primitive.colors.length > 0, "invariant: expected not to be using vertex colors");
  let i = 0;
  for (const { r, g, b, a } of primitive.colors) {
    colorsOut[i++] = SRGBToLinear(r);
    colorsOut[i++] = SRGBToLinear(g);
    colorsOut[i++] = SRGBToLinear(b);
    colorsOut[i++] = a;
  }

  const isLoop = primitive.type === LineType.LINE_LOOP;
  if (isLoop && colorsOut.length > 4) {
    colorsOut.copyWithin(i, 0, 4);
  }
}

function serializeColorsWithIndices(colorsOut: Float32Array, primitive: LinePrimitive): void {
  const indices = primitive.indices;
  assert(indices.length > 0, "Indices must have length");
  assert(
    colorsOut.length >= indices.length * 4,
    `colorsOut buffer must have a length (${colorsOut.length}) >= to primitive.indices.length (${primitive.indices.length}) * 4`,
  );
  assert(primitive.colors.length > 0, "Invariant: expected not to be using vertex colors");

  let i = 0;
  for (const idx of indices) {
    const { r, g, b, a } = primitive.colors[idx]!;
    colorsOut[i++] = SRGBToLinear(r);
    colorsOut[i++] = SRGBToLinear(g);
    colorsOut[i++] = SRGBToLinear(b);
    colorsOut[i++] = a;
  }
  const isLoop = primitive.type === LineType.LINE_LOOP;
  if (isLoop && colorsOut.length > 4) {
    colorsOut.copyWithin(i, 0, 4);
  }
}

class PickingMaterial extends LineMaterialWithAlphaVertex {
  public constructor() {
    super({
      worldUnits: false,
      vertexColors: false,
      linewidth: 0,
      transparent: false,
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
