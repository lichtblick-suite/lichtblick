/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { waitFor } from "@testing-library/react";
import * as THREE from "three";

import { EDGE_LINE_SEGMENTS_NAME } from "@lichtblick/suite-base/panels/ThreeDeeRender/ModelCache";

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
  it("updates embedded materials in place when only opacity changes", async () => {
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

    const materialAfterLoad = embeddedMaterial(renderable);
    renderable.update(makeMarker(0.5), 1n);

    expect(load).toHaveBeenCalledTimes(1);
    expect(embeddedMaterial(renderable)).toBe(materialAfterLoad);
    expect(embeddedMaterial(renderable)?.opacity).toBeCloseTo(0.4);
    expect(embeddedMaterial(renderable)?.transparent).toBe(true);
    expect(embeddedMaterial(renderable)?.depthWrite).toBe(false);

    // A second opacity change must keep multiplying against the original, not the previous result.
    renderable.update(makeMarker(0.25), 2n);
    expect(load).toHaveBeenCalledTimes(1);
    expect(embeddedMaterial(renderable)?.opacity).toBeCloseTo(0.2);

    expect(cachedMaterial.opacity).toBe(0.8);
    expect(cachedMaterial.transparent).toBe(false);
    renderable.dispose();
  });

  it("re-applies the latest opacity when it changes during an in-flight load", async () => {
    const cachedMaterial = new THREE.MeshStandardMaterial({ opacity: 0.8 });
    const cachedModel = new THREE.Group();
    cachedModel.add(new THREE.Mesh(new THREE.BoxGeometry(), cachedMaterial));

    let resolveLoad!: (model: THREE.Group) => void;
    const load = jest.fn().mockImplementation(async () => {
      return await new Promise<THREE.Group>((resolve) => {
        resolveLoad = resolve;
      });
    });
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
    expect(load).toHaveBeenCalledTimes(1);

    // Opacity changes while the mesh is still loading — cannot update in place yet.
    renderable.update(makeMarker(0.5), 1n);
    expect(load).toHaveBeenCalledTimes(1);

    resolveLoad(cachedModel);

    await waitFor(() => {
      expect(embeddedMaterial(renderable)?.opacity).toBeCloseTo(0.4);
    });
    renderable.dispose();
  });

  it("hides mesh edge outlines when marker alpha is below 1", async () => {
    const cachedMaterial = new THREE.MeshStandardMaterial({ opacity: 1 });
    const cachedModel = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), cachedMaterial);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry()),
      new THREE.LineBasicMaterial(),
    );
    edges.name = EDGE_LINE_SEGMENTS_NAME;
    cachedModel.add(mesh, edges);

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
    });

    let outlineVisible = true;
    renderable.traverse((obj) => {
      if (obj instanceof THREE.LineSegments && obj.name === EDGE_LINE_SEGMENTS_NAME) {
        outlineVisible = obj.visible;
      }
    });
    expect(outlineVisible).toBe(true);

    renderable.update(makeMarker(0.5), 1n);

    renderable.traverse((obj) => {
      if (obj instanceof THREE.LineSegments && obj.name === EDGE_LINE_SEGMENTS_NAME) {
        outlineVisible = obj.visible;
      }
    });
    expect(outlineVisible).toBe(false);

    renderable.dispose();
  });
});
