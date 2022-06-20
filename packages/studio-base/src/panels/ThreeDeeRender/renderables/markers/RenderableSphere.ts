// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable no-underscore-dangle */

import * as THREE from "three";

import type { Renderer } from "../../Renderer";
import { rgbaEqual } from "../../color";
import { DetailLevel, sphereSubdivisions } from "../../lod";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { releaseStandardMaterial, standardMaterial } from "./materials";

export class RenderableSphere extends RenderableMarker {
  private static _lod: DetailLevel | undefined;
  private static _geometry: THREE.SphereGeometry | undefined;

  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.Material>;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    // Sphere mesh
    const material = standardMaterial(marker.color, renderer.materialCache);
    this.mesh = new THREE.Mesh(RenderableSphere.geometry(renderer.maxLod), material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    this.update(marker, receiveTime);
  }

  override dispose(): void {
    releaseStandardMaterial(this.userData.marker.color, this.renderer.materialCache);
  }

  override update(marker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    if (!rgbaEqual(marker.color, prevMarker.color)) {
      releaseStandardMaterial(prevMarker.color, this.renderer.materialCache);
      this.mesh.material = standardMaterial(marker.color, this.renderer.materialCache);
    }

    this.scale.set(marker.scale.x, marker.scale.y, marker.scale.z);
  }

  static geometry(lod: DetailLevel): THREE.SphereGeometry {
    if (!RenderableSphere._geometry || lod !== RenderableSphere._lod) {
      const subdivisions = sphereSubdivisions(lod);
      RenderableSphere._geometry = new THREE.SphereGeometry(0.5, subdivisions, subdivisions);
      RenderableSphere._geometry.computeBoundingSphere();
      RenderableSphere._lod = lod;
    }
    return RenderableSphere._geometry;
  }
}
