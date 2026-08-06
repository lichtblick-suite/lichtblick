/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { setupJestCanvasMock } from "jest-canvas-mock";

import { IRenderer } from "../IRenderer";
import { ModelCache, ModelCacheOptions } from "../ModelCache"
import * as THREE from "three";

import { createRenderable } from "./Urdfs";
import { CUBE_GLB_TEST } from "./MockAssets";

import {
  UrdfGeometryMesh,
  UrdfRobot,
  UrdfVisual,
} from "@lichtblick/den/urdf";

jest.mock("three/examples/jsm/libs/draco/draco_decoder.wasm", () => "");

async function mockFetch(url: string, opts?: { signal?: AbortSignal }) {
  let response = {};

  switch (url) {
    case 'file:///mock/cube.glb':
      response = CUBE_GLB_TEST;
      break;
    default:
      throw new Error("Unknown mock file");
  }

  return {
    uri: url,
    data: new Uint8Array(response),
    mediaType: undefined,
  };
}

const mockAdd = jest.fn();
const mockAddToTopic = jest.fn();
const mockRemove = jest.fn();
const mockRemoveFromTopic = jest.fn();
const hasError = jest.fn();

const modelCache = new ModelCache({
  edgeMaterial: new THREE.LineBasicMaterial({ dithering: true }),
  ignoreColladaUpAxis: true,
  meshUpAxis: "y_up",
  fetchAsset: mockFetch
});

const mockRenderer: IRenderer = {
  queueAnimationFrame: jest.fn(),
  normalizeFrameId: jest.fn((id) => id),
  settings: {
    errors: {
      add: mockAdd,
      addToTopic: mockAddToTopic,
      remove: mockRemove,
      removeFromTopic: mockRemoveFromTopic,
      hasError: hasError
    },
  },
  config: {
    topics: new Map()
  },
  modelCache: modelCache
} as unknown as IRenderer;

describe("Urdfs", () => {
  describe("loading glTF files", () => {
    let robot: UrdfRobot = { name: "mock" };
    let visual: UrdfVisual = {
      geometry: {
        geometryType: "mesh",
        filename: "file:///mock/cube.glb",
      },

      origin: {
        xyz: {x: 0, y: 0, z: 0},
        rpy: {x: 0, y: 0, z: 0}
      }
    };

    let renderable = createRenderable({
      visual: visual,
      robot: robot,
      id: 0,
      frameId: "test-frame",
      renderer: mockRenderer
    });

    it("should preserve embedded materials", () => {
      const expected = {
        isColor: true,
        r: 0.8000074625015259,
        g: 0.058865584433078766,
        b: 0.03260880336165428
      };

      expect(renderable['mesh'].children[0].material.color).toEqual(expected);
    });
  });
});
