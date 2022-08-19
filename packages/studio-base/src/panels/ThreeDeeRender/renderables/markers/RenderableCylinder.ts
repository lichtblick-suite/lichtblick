// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { Renderer } from "../../Renderer";
import { rgbToThreeColor } from "../../color";
import { cylinderSubdivisions, DetailLevel } from "../../lod";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { makeStandardMaterial } from "./materials";

export class RenderableCylinder extends RenderableMarker {
  private static lod: DetailLevel | undefined;
  private static cylinderGeometry: THREE.CylinderGeometry | undefined;
  private static cylinderEdgesGeometry: THREE.EdgesGeometry | undefined;

  private mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  private outline: THREE.LineSegments | undefined;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: Renderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    // Cylinder mesh
    const material = makeStandardMaterial(marker.color);
    const cylinderGeometry = RenderableCylinder.Geometry(renderer.maxLod);
    this.mesh = new THREE.Mesh(cylinderGeometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    // Cylinder outline
    const edgesGeometry = RenderableCylinder.EdgesGeometry(renderer.maxLod);
    this.outline = new THREE.LineSegments(edgesGeometry, renderer.outlineMaterial);
    this.outline.userData.picking = false;
    this.mesh.add(this.outline);

    this.update(marker, receiveTime);
  }

  public override dispose(): void {
    this.mesh.material.dispose();
  }

  public override update(marker: Marker, receiveTime: bigint | undefined): void {
    super.update(marker, receiveTime);

    const transparent = marker.color.a < 1;
    if (transparent !== this.mesh.material.transparent) {
      this.mesh.material.transparent = transparent;
      this.mesh.material.depthWrite = !transparent;
      this.mesh.material.needsUpdate = true;
    }

    rgbToThreeColor(this.mesh.material.color, marker.color);
    this.mesh.material.opacity = marker.color.a;

    this.scale.set(marker.scale.x, marker.scale.y, marker.scale.z);
  }

  private static Geometry(lod: DetailLevel): THREE.CylinderGeometry {
    if (!RenderableCylinder.cylinderGeometry || lod !== RenderableCylinder.lod) {
      const subdivisions = cylinderSubdivisions(lod);
      RenderableCylinder.cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, subdivisions);
      RenderableCylinder.cylinderGeometry.rotateX(Math.PI / 2); // Make the cylinder geometry stand upright
      RenderableCylinder.cylinderGeometry.computeBoundingSphere();
      RenderableCylinder.lod = lod;
    }
    return RenderableCylinder.cylinderGeometry;
  }

  private static EdgesGeometry(lod: DetailLevel): THREE.EdgesGeometry {
    if (!RenderableCylinder.cylinderEdgesGeometry) {
      const geometry = RenderableCylinder.Geometry(lod);
      RenderableCylinder.cylinderEdgesGeometry = new THREE.EdgesGeometry(geometry, 40);
      RenderableCylinder.cylinderEdgesGeometry.computeBoundingSphere();
    }
    return RenderableCylinder.cylinderEdgesGeometry;
  }
}
