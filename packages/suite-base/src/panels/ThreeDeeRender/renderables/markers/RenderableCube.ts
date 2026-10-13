// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { RenderableOutlinedMeshMarker } from "./RenderableOutlinedMeshMarker";
import { makeStandardMaterial } from "./materials";
import type { IRenderer } from "../../IRenderer";
import { Marker } from "../../ros";

export class RenderableCube extends RenderableOutlinedMeshMarker {
  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: IRenderer,
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
