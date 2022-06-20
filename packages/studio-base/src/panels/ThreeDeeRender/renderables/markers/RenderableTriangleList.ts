// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { Renderer } from "../../Renderer";
import { rgbaToLinear } from "../../color";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import {
  markerHasTransparency,
  releaseStandardVertexColorMaterial,
  standardVertexColorMaterial,
} from "./materials";

const NOT_DIVISIBLE_ERR = "NOT_DIVISIBLE";
const EMPTY_ERR = "EMPTY";
const COLORS_MISMATCH_ERR = "COLORS_MISMATCH";
const EMPTY_FLOAT32 = new Float32Array();

const tempColor = { r: 0, g: 0, b: 0, a: 0 };

export class RenderableTriangleList extends RenderableMarker {
  geometry: THREE.BufferGeometry;
  mesh: THREE.Mesh;
  vertices: Float32Array;
  colors: Float32Array;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    this.geometry = new THREE.BufferGeometry();

    this.vertices = new Float32Array(marker.points.length * 3);
    this.colors = new Float32Array(marker.colors.length * 4);

    const material = standardVertexColorMaterial(marker, renderer.materialCache);
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    this.update(marker, receiveTime);
  }

  override dispose(): void {
    releaseStandardVertexColorMaterial(this.userData.marker, this.renderer.materialCache);
    this.geometry.dispose();
    this.vertices = new Float32Array();
    this.colors = new Float32Array();
  }

  override update(marker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    let vertexCount = marker.points.length;
    const count = vertexCount * 3;
    if (vertexCount === 0) {
      this.renderer.settings.errors.addToTopic(
        this.userData.topic,
        EMPTY_ERR,
        `TRIANGLE_LIST: points is empty`,
      );
      this.geometry.setAttribute("position", new THREE.BufferAttribute(EMPTY_FLOAT32, 3));
      return;
    }
    if (vertexCount % 3 !== 0) {
      this.renderer.settings.errors.addToTopic(
        this.userData.topic,
        NOT_DIVISIBLE_ERR,
        `TRIANGLE_LIST: points[${vertexCount}] is not divisible by 3`,
      );
      vertexCount = Math.floor(vertexCount / 3) * 3;
    }
    if (marker.colors.length !== 0 && marker.colors.length !== vertexCount) {
      this.renderer.settings.errors.addToTopic(
        this.userData.topic,
        COLORS_MISMATCH_ERR,
        `TRIANGLE_LIST: colors[${marker.colors.length}] != points[${vertexCount}]`,
      );
      // Non-critical, we'll fall back to the default color if needed
    }

    this.renderer.settings.errors.clearTopic(this.userData.topic);

    if (markerHasTransparency(marker) !== markerHasTransparency(prevMarker)) {
      releaseStandardVertexColorMaterial(prevMarker, this.renderer.materialCache);
      this.mesh.material = standardVertexColorMaterial(marker, this.renderer.materialCache);
    }

    let dataChanged = false;

    if (count !== this.vertices.length) {
      this.vertices = new Float32Array(count);
      dataChanged = true;
    }
    if (vertexCount * 4 !== this.colors.length) {
      this.colors = new Float32Array(vertexCount * 4);
      dataChanged = true;
    }
    const { vertices, colors } = this;

    // Update position/color buffers with the new marker data
    for (let i = 0; i < vertexCount; i++) {
      const point = marker.points[i]!;
      dataChanged =
        dataChanged ||
        vertices[i * 3] !== point.x ||
        vertices[i * 3 + 1] !== point.y ||
        vertices[i * 3 + 2] !== point.z;
      vertices[i * 3] = point.x;
      vertices[i * 3 + 1] = point.y;
      vertices[i * 3 + 2] = point.z;

      rgbaToLinear(tempColor, marker.colors[i] ?? marker.color);
      dataChanged =
        dataChanged ||
        colors[i * 4] !== tempColor.r ||
        colors[i * 4 + 1] !== tempColor.g ||
        colors[i * 4 + 2] !== tempColor.b ||
        colors[i * 4 + 3] !== tempColor.a;
      colors[i * 4] = tempColor.r;
      colors[i * 4 + 1] = tempColor.g;
      colors[i * 4 + 2] = tempColor.b;
      colors[i * 4 + 3] = tempColor.a;
    }

    if (dataChanged) {
      this.geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
      // Explicitly tell three.js to send position and color buffers to the GPU
      this.geometry.attributes.position!.needsUpdate = true;
      this.geometry.attributes.color!.needsUpdate = true;
      // Build the vertex normal attribute from the position buffer (averaging face normals)
      this.geometry.computeVertexNormals();
      this.geometry.computeBoundingSphere();
    }
  }
}
