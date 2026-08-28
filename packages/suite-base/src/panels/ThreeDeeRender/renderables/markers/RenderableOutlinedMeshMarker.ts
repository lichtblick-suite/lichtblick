// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { RenderableMarker } from "./RenderableMarker";
import { updateStandardMeshMarker } from "./materials";
import { Marker } from "../../ros";

/** Shared update/dispose path for markers that use one standard mesh plus an outline. */
export abstract class RenderableOutlinedMeshMarker extends RenderableMarker {
  protected mesh!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  protected outline!: THREE.Object3D;

  public override dispose(): void {
    this.mesh.material.dispose();
  }

  public override update(newMarker: Marker, receiveTime: bigint | undefined): void {
    super.update(newMarker, receiveTime);
    updateStandardMeshMarker(
      this,
      this.mesh,
      this.outline,
      this.getSettings(),
      this.userData.marker,
    );
  }
}
