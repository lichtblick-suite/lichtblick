/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { waitFor } from "@testing-library/react";
import * as THREE from "three";

import { RenderableMeshResource } from "./RenderableMeshResource";
import { IRenderer } from "../../IRenderer";
import { Marker, MarkerAction, MarkerType } from "../../ros";

jest.mock("three/examples/jsm/libs/draco/draco_decoder.wasm", () => "");

function makeMarker(opacity: number): Marker {
  return {
    header: { frame_id: "map", stamp: { sec: 0, nsec: 0 } },
    ns: "",
    id: 1,
    type: MarkerType.MESH_RESOURCE,
    action: MarkerAction.ADD,
    pose: {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    },
    scale: { x: 1, y: 1, z: 1 },
    color: { r: 1, g: 1, b: 1, a: opacity },
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "package://robot/model.dae",
    mesh_use_embedded_materials: true,
  };
}

function embeddedMaterial(renderable: RenderableMeshResource): THREE.Material | undefined {
  let result: THREE.Material | undefined;
  renderable.traverse((child) => {
    if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
      result = child.material;
    }
  });
  return result;
}

describe("RenderableMeshResource embedded opacity", () => {
  it("reloads embedded materials when opacity changes without changing the resource", async () => {
    const cachedMaterial = new THREE.MeshStandardMaterial({ opacity: 0.8 });
    const cachedModel = new THREE.Group();
    cachedModel.add(new THREE.Mesh(new THREE.BoxGeometry(), cachedMaterial));
    const load = jest.fn().mockResolvedValue(cachedModel);
    const renderer = {
      normalizeFrameId: (frameId: string) => frameId,
      config: { topics: {} },
      modelCache: { load },
      settings: {
        errors: {
          add: jest.fn(),
          remove: jest.fn(),
          hasError: jest.fn().mockReturnValue(false),
        },
      },
      queueAnimationFrame: jest.fn(),
    } as unknown as IRenderer;
    const renderable = new RenderableMeshResource(
      "/robot_description",
      makeMarker(1),
      0n,
      renderer,
    );

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
      expect(embeddedMaterial(renderable)?.opacity).toBeCloseTo(0.8);
    });

    renderable.update(makeMarker(0.5), 1n);

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
      expect(embeddedMaterial(renderable)?.opacity).toBeCloseTo(0.4);
      expect(embeddedMaterial(renderable)?.transparent).toBe(true);
      expect(embeddedMaterial(renderable)?.depthWrite).toBe(false);
    });
    expect(cachedMaterial.opacity).toBe(0.8);
    expect(cachedMaterial.transparent).toBe(false);
    renderable.dispose();
  });
});
