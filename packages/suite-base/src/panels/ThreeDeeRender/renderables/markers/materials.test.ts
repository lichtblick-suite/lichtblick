/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import {
  shouldShowMarkerOutlines,
  updateStandardMaterialColor,
  updateStandardMeshMarker,
} from "./materials";
import { Marker, MarkerAction, MarkerType } from "../../ros";

function makeMarker(opacity: number): Marker {
  return {
    header: { frame_id: "link", stamp: { sec: 0, nsec: 0 } },
    ns: "",
    id: 0,
    type: MarkerType.CUBE,
    action: MarkerAction.ADD,
    pose: {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    },
    scale: { x: 1, y: 1, z: 1 },
    color: { r: 1, g: 0, b: 0, a: opacity },
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

describe("shouldShowMarkerOutlines", () => {
  it("defaults showOutlines to true and requires opaque alpha", () => {
    expect(shouldShowMarkerOutlines({ showOutlines: undefined, alpha: 1 })).toBe(true);
    expect(shouldShowMarkerOutlines({ showOutlines: undefined, alpha: 0.5 })).toBe(false);
    expect(shouldShowMarkerOutlines({ showOutlines: true, alpha: 1 })).toBe(true);
    expect(shouldShowMarkerOutlines({ showOutlines: false, alpha: 1 })).toBe(false);
    expect(shouldShowMarkerOutlines({ showOutlines: true, alpha: 0.99 })).toBe(false);
  });
});

describe("updateStandardMaterialColor", () => {
  it("updates color, opacity, and transparency flags", () => {
    const material = new THREE.MeshStandardMaterial({
      transparent: false,
      depthWrite: true,
      opacity: 1,
    });

    updateStandardMaterialColor(material, { r: 1, g: 0, b: 0, a: 0.4 });

    expect(material.opacity).toBe(0.4);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);

    updateStandardMaterialColor(material, { r: 0, g: 1, b: 0, a: 1 });

    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
  });
});

describe("updateStandardMeshMarker", () => {
  it("updates material, scale, and hides outlines when translucent", () => {
    const material = new THREE.MeshStandardMaterial({
      transparent: false,
      depthWrite: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    const outline = new THREE.Object3D();
    outline.visible = true;
    const target = new THREE.Object3D();
    const marker = makeMarker(0.5);
    marker.scale = { x: 2, y: 3, z: 4 };

    updateStandardMeshMarker(target, mesh, outline, { showOutlines: true }, marker);

    expect(material.opacity).toBe(0.5);
    expect(material.transparent).toBe(true);
    expect(outline.visible).toBe(false);
    expect(target.scale.x).toBe(2);
    expect(target.scale.y).toBe(3);
    expect(target.scale.z).toBe(4);
  });
});
