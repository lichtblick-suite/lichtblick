/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as THREE from "three";

import { ModelCache } from "./ModelCache";
import { CUBE_GLB_TEST } from "./renderables/MockAssets";

jest.mock("three/examples/jsm/libs/draco/draco_decoder.wasm", () => "");

async function mockFetch(url: string, _opts?: { signal?: AbortSignal }) {
  let response: Uint8Array = new Uint8Array();

  switch (url) {
    case "file:///mock/cube.glb":
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

const mockError = jest.fn();

describe("ModelCache", () => {
  describe("loading glTF files", () => {
    it("should respect meshUpAxis option", async () => {
      const modelCache = new ModelCache({
        edgeMaterial: new THREE.LineBasicMaterial({ dithering: true }),
        ignoreColladaUpAxis: true,
        meshUpAxis: "y_up",
        fetchAsset: mockFetch,
      });

      const model = await modelCache.load("file:///mock/cube.glb", {}, mockError);

      expect(model?.rotation.x).toEqual(1.5707963267948963);
      expect(model?.rotation.y).toEqual(0);
      // FP inaccurary means this is 'neg' zero after the rotation.
      expect(model?.rotation.z).toEqual(-0);

      (console.warn as jest.Mock).mockClear();
    });
  });
});
