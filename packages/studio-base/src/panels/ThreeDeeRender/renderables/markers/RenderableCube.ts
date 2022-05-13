// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable no-underscore-dangle */

import * as THREE from "three";

import type { Renderer } from "../../Renderer";
import { rgbaEqual } from "../../color";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { releaseStandardMaterial, standardMaterial } from "./materials";

export class RenderableCube extends RenderableMarker {
  private static _geometry: THREE.BoxGeometry | undefined;
  private static _edgesGeometry: THREE.EdgesGeometry | undefined;

  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.Material>;
  outline: THREE.LineSegments | undefined;

  constructor(topic: string, marker: Marker, renderer: Renderer) {
    super(topic, marker, renderer);

    // Cube mesh
    this.mesh = new THREE.Mesh(
      RenderableCube.geometry(),
      standardMaterial(marker.color, renderer.materialCache),
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    // Cube outline
    this.outline = new THREE.LineSegments(
      RenderableCube.edgesGeometry(),
      renderer.materialCache.outlineMaterial,
    );
    this.outline.userData.picking = false;
    this.mesh.add(this.outline);

    this.update(marker);
  }

  override dispose(): void {
    releaseStandardMaterial(this.userData.marker.color, this._renderer.materialCache);
  }

  override update(marker: Marker): void {
    const prevMarker = this.userData.marker;
    super.update(marker);

    if (!rgbaEqual(marker.color, prevMarker.color)) {
      releaseStandardMaterial(prevMarker.color, this._renderer.materialCache);
      this.mesh.material = standardMaterial(marker.color, this._renderer.materialCache);
    }

    this.scale.set(marker.scale.x, marker.scale.y, marker.scale.z);
  }

  static geometry(): THREE.BoxGeometry {
    if (!RenderableCube._geometry) {
      RenderableCube._geometry = new THREE.BoxGeometry(1, 1, 1);
      RenderableCube._geometry.computeBoundingSphere();
    }
    return RenderableCube._geometry;
  }

  static edgesGeometry(): THREE.EdgesGeometry {
    if (!RenderableCube._edgesGeometry) {
      RenderableCube._edgesGeometry = new THREE.EdgesGeometry(RenderableCube.geometry(), 40);
      RenderableCube._edgesGeometry.computeBoundingSphere();
    }
    return RenderableCube._edgesGeometry;
  }
}
