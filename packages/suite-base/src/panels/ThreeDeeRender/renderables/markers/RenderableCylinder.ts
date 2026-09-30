// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { RenderableOutlinedMeshMarker } from "./RenderableOutlinedMeshMarker";
import { makeStandardMaterial } from "./materials";
import type { IRenderer } from "../../IRenderer";
import { cylinderSubdivisions, DetailLevel } from "../../lod";
import { Marker } from "../../ros";

export class RenderableCylinder extends RenderableOutlinedMeshMarker {
  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: IRenderer,
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
