// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { Renderer } from "../../Renderer";
import { rgbaEqual } from "../../color";
import { cylinderSubdivisions, DetailLevel } from "../../lod";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { releaseStandardMaterial, standardMaterial } from "./materials";

export class RenderableCylinder extends RenderableMarker {
  private static lod: DetailLevel | undefined;
  private static geometry: THREE.CylinderGeometry | undefined;
  private static edgesGeometry: THREE.EdgesGeometry | undefined;

  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.Material>;
  outline: THREE.LineSegments | undefined;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    // Cylinder mesh
    const material = standardMaterial(marker.color, renderer.materialCache);
    this.mesh = new THREE.Mesh(RenderableCylinder.Geometry(renderer.maxLod), material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    // Cylinder outline
    this.outline = new THREE.LineSegments(
      RenderableCylinder.EdgesGeometry(renderer.maxLod),
      renderer.materialCache.outlineMaterial,
    );
    this.outline.userData.picking = false;
    this.mesh.add(this.outline);

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

  static Geometry(lod: DetailLevel): THREE.CylinderGeometry {
    if (!RenderableCylinder.geometry || lod !== RenderableCylinder.lod) {
      const subdivisions = cylinderSubdivisions(lod);
      RenderableCylinder.geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, subdivisions);
      RenderableCylinder.geometry.rotateX(Math.PI / 2); // Make the cylinder geometry stand upright
      RenderableCylinder.geometry.computeBoundingSphere();
      RenderableCylinder.lod = lod;
    }
    return RenderableCylinder.geometry;
  }

  static EdgesGeometry(lod: DetailLevel): THREE.EdgesGeometry {
    if (!RenderableCylinder.edgesGeometry) {
      const geometry = RenderableCylinder.Geometry(lod);
      RenderableCylinder.edgesGeometry = new THREE.EdgesGeometry(geometry, 40);
      RenderableCylinder.edgesGeometry.computeBoundingSphere();
    }
    return RenderableCylinder.edgesGeometry;
  }
}
