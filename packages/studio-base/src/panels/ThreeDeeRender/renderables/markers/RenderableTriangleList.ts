// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { Renderer } from "../../Renderer";
import { rgbaToLinear } from "../../color";
import { Marker, Vector3 } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { markerHasTransparency, makeStandardVertexColorMaterial } from "./materials";

const NOT_DIVISIBLE_ERR = "NOT_DIVISIBLE";
const EMPTY_ERR = "EMPTY";
const COLORS_MISMATCH_ERR = "COLORS_MISMATCH";
const INVALID_POINT_ERR = "INVALID_POINT";
const EMPTY_FLOAT32 = new Float32Array();

const tempColor = { r: 0, g: 0, b: 0, a: 0 };

export class RenderableTriangleList extends RenderableMarker {
  private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private vertices: Float32Array;
  private colors: Float32Array;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: Renderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    this.vertices = new Float32Array(marker.points.length * 3);
    this.colors = new Float32Array(marker.colors.length * 4);

    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), makeStandardVertexColorMaterial(marker));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    this.update(marker, receiveTime);
  }

  public override dispose(): void {
    this.mesh.material.dispose();
    this.mesh.geometry.dispose();
    this.vertices = new Float32Array();
    this.colors = new Float32Array();
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
      this.mesh.geometry.setAttribute("position", new THREE.BufferAttribute(EMPTY_FLOAT32, 3));
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
      this.mesh.material.transparent = transparent;
      this.mesh.material.depthWrite = !transparent;
      this.mesh.material.needsUpdate = true;
    }

    let dataChanged = false;

    const count = vertexCount * 3;
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
      const geometry = this.mesh.geometry;
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
      // Explicitly tell three.js to send position and color buffers to the GPU
      geometry.attributes.position!.needsUpdate = true;
      geometry.attributes.color!.needsUpdate = true;
      // Build the vertex normal attribute from the position buffer (averaging face normals)
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    }
  }
}

function isPointValid(pt: Vector3): boolean {
  return Number.isFinite(pt.x) && Number.isFinite(pt.y) && Number.isFinite(pt.z);
}
