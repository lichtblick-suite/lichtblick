/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { RenderableCube } from "./RenderableCube";
import { RenderableCylinder } from "./RenderableCylinder";
import { IRenderer } from "../../IRenderer";
import { Marker, MarkerAction, MarkerType } from "../../ros";

function makePrimitiveMarker(opacity: number): Marker {
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

function makeRenderer(): IRenderer {
  return {
    normalizeFrameId: (frameId: string) => frameId,
    config: { topics: {} },
    maxLod: 0,
    sharedGeometry: {
      getGeometry: (_key: string, factory: () => THREE.BufferGeometry) => factory(),
    },
    outlineMaterial: new THREE.LineBasicMaterial(),
  } as unknown as IRenderer;
}

function outlineVisible(renderable: THREE.Object3D): boolean | undefined {
  let visible: boolean | undefined;
  renderable.traverse((obj) => {
    if (obj instanceof THREE.LineSegments) {
      visible = obj.visible;
    }
  });
  return visible;
}

describe("primitive marker outline opacity", () => {
  it("RenderableCube hides outline when marker alpha is below 1", () => {
    const renderer = makeRenderer();
    const renderable = new RenderableCube("urdf", makePrimitiveMarker(1), 0n, renderer);

    expect(outlineVisible(renderable)).toBe(true);

    renderable.update(makePrimitiveMarker(0.5), 1n);
    expect(outlineVisible(renderable)).toBe(false);

    renderable.dispose();
  });

  it("RenderableCylinder hides outline when marker alpha is below 1", () => {
    const renderer = makeRenderer();
    const renderable = new RenderableCylinder("urdf", makePrimitiveMarker(1), 0n, renderer);

    expect(outlineVisible(renderable)).toBe(true);

    renderable.update(makePrimitiveMarker(0.25), 1n);
    expect(outlineVisible(renderable)).toBe(false);

    renderable.dispose();
  });
});
