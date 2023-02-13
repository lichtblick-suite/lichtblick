// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { RenderableMarker } from "./RenderableMarker";
import { makeStandardMaterial } from "./materials";
import type { Renderer } from "../../Renderer";
import { rgbToThreeColor } from "../../color";
import { cylinderSubdivisions, DetailLevel } from "../../lod";
import { Marker } from "../../ros";

export class RenderableCylinder extends RenderableMarker {
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
    const cylinderGeometry = renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-cylinder-${renderer.maxLod}`,
      () => createGeometry(renderer.maxLod),
    );
    this.mesh = new THREE.Mesh(cylinderGeometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    // Cylinder outline
    const edgesGeometry = renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-edges-${renderer.maxLod}`,
      () => createEdgesGeometry(cylinderGeometry),
    );
    this.outline = new THREE.LineSegments(edgesGeometry, renderer.outlineMaterial);
    this.outline.userData.picking = false;
    this.mesh.add(this.outline);

    this.update(marker, receiveTime);
  }

  public override dispose(): void {
    this.mesh.material.dispose();
  }

  public override update(newMarker: Marker, receiveTime: bigint | undefined): void {
    super.update(newMarker, receiveTime);
    const marker = this.userData.marker;

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
}
function createGeometry(lod: DetailLevel): THREE.CylinderGeometry {
  const subdivisions = cylinderSubdivisions(lod);
  const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, subdivisions);
  cylinderGeometry.rotateX(Math.PI / 2); // Make the cylinder geometry stand upright
  cylinderGeometry.computeBoundingSphere();
  return cylinderGeometry;
}

function createEdgesGeometry(geometry: THREE.CylinderGeometry): THREE.EdgesGeometry {
  const cylinderEdgesGeometry = new THREE.EdgesGeometry(geometry, 40);
  cylinderEdgesGeometry.computeBoundingSphere();
  return cylinderEdgesGeometry;
}
