// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { RenderableMarker } from "./RenderableMarker";
import { markerHasTransparency, makeStandardVertexColorMaterial } from "./materials";
import { DynamicBufferGeometry } from "../../DynamicBufferGeometry";
import type { Renderer } from "../../Renderer";
import { rgbaToLinear } from "../../color";
import { Marker, Vector3 } from "../../ros";

const NOT_DIVISIBLE_ERR = "NOT_DIVISIBLE";
const EMPTY_ERR = "EMPTY";
const COLORS_MISMATCH_ERR = "COLORS_MISMATCH";
const INVALID_POINT_ERR = "INVALID_POINT";

const tempColor = { r: 0, g: 0, b: 0, a: 0 };

export class RenderableTriangleList extends RenderableMarker {
  #mesh: THREE.Mesh<DynamicBufferGeometry, THREE.MeshStandardMaterial>;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: Renderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    this.#mesh = new THREE.Mesh(
      new DynamicBufferGeometry(),
      makeStandardVertexColorMaterial(marker),
    );
    this.#mesh.castShadow = true;
    this.#mesh.receiveShadow = true;
    this.add(this.#mesh);

    this.update(marker, receiveTime);
  }

  public override dispose(): void {
    this.#mesh.material.dispose();
    this.#mesh.geometry.dispose();
  }

  public override update(newMarker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(newMarker, receiveTime);
    const marker = this.userData.marker;

    let vertexCount = marker.points.length;
    if (vertexCount === 0) {
      this.renderer.settings.errors.addToTopic(
        this.userData.topic,
        EMPTY_ERR,
        `TRIANGLE_LIST: points is empty`,
      );
      this.#mesh.geometry.resize(0);
      return;
    }
    if (vertexCount % 3 !== 0) {
      const markerId = `${marker.ns.length > 0 ? marker.ns + ":" : ""}${marker.id}`;
      this.renderer.settings.errors.addToTopic(
        this.userData.topic,
        NOT_DIVISIBLE_ERR,
        `TRIANGLE_LIST: points.length ${vertexCount} is not divisible by 3 for marker ${markerId}`,
      );
      vertexCount = Math.floor(vertexCount / 3) * 3;
    }
    if (marker.colors.length !== 0 && marker.colors.length !== vertexCount) {
      const markerId = `${marker.ns.length > 0 ? marker.ns + ":" : ""}${marker.id}`;
      this.renderer.settings.errors.addToTopic(
        this.userData.topic,
        COLORS_MISMATCH_ERR,
        `TRIANGLE_LIST: colors.length ${marker.colors.length} != points.length ${vertexCount} for marker ${markerId}`,
      );
      // Non-critical, we'll fall back to the default color if needed
    }

    const transparent = markerHasTransparency(marker);
    if (transparent !== markerHasTransparency(prevMarker)) {
      this.#mesh.material.transparent = transparent;
      this.#mesh.material.depthWrite = !transparent;
      this.#mesh.material.needsUpdate = true;
    }

    const geometry = this.#mesh.geometry;
    geometry.resize(vertexCount);
    if (!geometry.attributes.position) {
      geometry.createAttribute("position", Float32Array, 3);
    }
    if (!geometry.attributes.normal) {
      geometry.createAttribute("normal", Float32Array, 3);
    }
    if (!geometry.attributes.color) {
      geometry.createAttribute("color", Uint8Array, 4, true);
    }

    const vertices = geometry.attributes.position!;
    const colors = geometry.attributes.color!;

    // Update position/color buffers with the new marker data
    let dataChanged = false;
    for (let i = 0; i < vertexCount; i++) {
      const point = marker.points[i]!;
      if (!isPointValid(point)) {
        this.renderer.settings.errors.addToTopic(
          this.userData.topic,
          INVALID_POINT_ERR,
          `TRIANGLE_LIST: point at index ${i} is not finite`,
        );
        continue;
      }
      dataChanged =
        dataChanged ||
        vertices.getX(i) !== point.x ||
        vertices.getY(i) !== point.y ||
        vertices.getZ(i) !== point.z;
      vertices.setXYZ(i, point.x, point.y, point.z);

      rgbaToLinear(tempColor, marker.colors[i] ?? marker.color);
      dataChanged =
        dataChanged ||
        colors.getX(i) !== tempColor.r ||
        colors.getY(i) !== tempColor.g ||
        colors.getZ(i) !== tempColor.b ||
        colors.getW(i) !== tempColor.a;
      colors.setXYZW(i, tempColor.r, tempColor.g, tempColor.b, tempColor.a);
    }

    if (dataChanged) {
      // Explicitly tell three.js to send position and color buffers to the GPU
      vertices.needsUpdate = true;
      colors.needsUpdate = true;
      // Build the vertex normal attribute from the position buffer (averaging face normals)
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    }
  }
}

function isPointValid(pt: Vector3): boolean {
  return Number.isFinite(pt.x) && Number.isFinite(pt.y) && Number.isFinite(pt.z);
}
