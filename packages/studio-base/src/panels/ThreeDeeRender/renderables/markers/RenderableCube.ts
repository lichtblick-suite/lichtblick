// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { RenderableMarker } from "./RenderableMarker";
import { makeStandardMaterial } from "./materials";
import type { Renderer } from "../../Renderer";
import { rgbToThreeColor } from "../../color";
import { Marker } from "../../ros";

export class RenderableCube extends RenderableMarker {
  private mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private outline: THREE.LineSegments;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: Renderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    // Cube mesh
    const cubeGeometry = this.renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-cube`,
      createGeometry,
    );
    const cubeEdgesGeometry = this.renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-cube-edges`,
      () => createEdgesGeometry(cubeGeometry),
    );
    this.mesh = new THREE.Mesh(cubeGeometry, makeStandardMaterial(marker.color));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    // Cube outline
    this.outline = new THREE.LineSegments(cubeEdgesGeometry, renderer.outlineMaterial);
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

    this.outline.visible = this.getSettings()?.showOutlines ?? true;

    rgbToThreeColor(this.mesh.material.color, marker.color);
    this.mesh.material.opacity = marker.color.a;

    this.scale.set(marker.scale.x, marker.scale.y, marker.scale.z);
  }
}

export function createGeometry(): THREE.BoxGeometry {
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  cubeGeometry.computeBoundingSphere();
  return cubeGeometry;
}
function createEdgesGeometry(cubeGeometry: THREE.BoxGeometry): THREE.EdgesGeometry {
  const cubeEdgesGeometry = new THREE.EdgesGeometry(cubeGeometry, 40);
  cubeEdgesGeometry.computeBoundingSphere();
  return cubeEdgesGeometry;
}
