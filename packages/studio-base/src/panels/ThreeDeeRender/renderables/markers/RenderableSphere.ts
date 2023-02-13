// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { RenderableMarker } from "./RenderableMarker";
import { makeStandardMaterial } from "./materials";
import type { Renderer } from "../../Renderer";
import { rgbToThreeColor } from "../../color";
import { DetailLevel, sphereSubdivisions } from "../../lod";
import { Marker } from "../../ros";

export class RenderableSphere extends RenderableMarker {
  public mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: Renderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    // Sphere mesh
    const geometry = renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-${renderer.maxLod}`,
      () => createGeometry(renderer.maxLod),
    );
    this.mesh = new THREE.Mesh(geometry, makeStandardMaterial(marker.color));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

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

export function createGeometry(lod: DetailLevel): THREE.SphereGeometry {
  const subdivisions = sphereSubdivisions(lod);
  const sphereGeometry = new THREE.SphereGeometry(0.5, subdivisions, subdivisions);
  sphereGeometry.computeBoundingSphere();
  return sphereGeometry;
}
