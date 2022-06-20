// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { DynamicInstancedMesh } from "../../DynamicInstancedMesh";
import type { Renderer } from "../../Renderer";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { RenderableSphere } from "./RenderableSphere";
import {
  markerHasTransparency,
  releaseStandardInstancedMaterial,
  standardInstancedMaterial,
} from "./materials";

export class RenderableSphereList extends RenderableMarker {
  mesh: DynamicInstancedMesh<THREE.SphereGeometry, THREE.Material>;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    // Sphere instanced mesh
    const material = standardInstancedMaterial(marker, renderer.materialCache);
    this.mesh = new DynamicInstancedMesh(
      RenderableSphere.geometry(renderer.maxLod),
      material,
      marker.points.length,
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    this.update(marker, receiveTime);
  }

  override dispose(): void {
    releaseStandardInstancedMaterial(this.userData.marker, this.renderer.materialCache);
  }

  override update(marker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    if (markerHasTransparency(marker) !== markerHasTransparency(prevMarker)) {
      releaseStandardInstancedMaterial(prevMarker, this.renderer.materialCache);
      this.mesh.material = standardInstancedMaterial(marker, this.renderer.materialCache);
    }

    this.mesh.set(marker.points, marker.scale, marker.colors, marker.color);
  }
}
