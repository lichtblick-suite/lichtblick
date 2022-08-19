// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { Renderer } from "../../Renderer";
import { rgbToThreeColor } from "../../color";
import { DetailLevel, sphereSubdivisions } from "../../lod";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { makeStandardMaterial } from "./materials";

export class RenderableSphere extends RenderableMarker {
  private static lod: DetailLevel | undefined;
  private static sphereGeometry: THREE.SphereGeometry | undefined;

  public mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: Renderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    // Sphere mesh
    const geometry = RenderableSphere.Geometry(renderer.maxLod);
    this.mesh = new THREE.Mesh(geometry, makeStandardMaterial(marker.color));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

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

  public static Geometry(lod: DetailLevel): THREE.SphereGeometry {
    if (!RenderableSphere.sphereGeometry || lod !== RenderableSphere.lod) {
      const subdivisions = sphereSubdivisions(lod);
      RenderableSphere.sphereGeometry = new THREE.SphereGeometry(0.5, subdivisions, subdivisions);
      RenderableSphere.sphereGeometry.computeBoundingSphere();
      RenderableSphere.lod = lod;
    }
    return RenderableSphere.sphereGeometry;
  }
}
