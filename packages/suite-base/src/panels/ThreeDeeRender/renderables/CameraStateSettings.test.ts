/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { setupJestCanvasMock } from "jest-canvas-mock";
import * as THREE from "three";

import { Asset } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { Renderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/Renderer";
import { DEFAULT_SCENE_EXTENSION_CONFIG } from "@lichtblick/suite-base/panels/ThreeDeeRender/SceneExtensionConfig";
import {
  DEFAULT_CAMERA_STATE,
  DEFAULT_ORBIT_CONTROLS_CONFIG,
} from "@lichtblick/suite-base/panels/ThreeDeeRender/camera";
import { DEFAULT_PUBLISH_SETTINGS } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/PublishSettings";

import { RendererConfig } from "../IRenderer";
import { CameraStateSettings } from "./CameraStateSettings";

let mockOrbitControls!: {
  screenSpacePanning: boolean;
  mouseButtons: { LEFT: number; RIGHT: number };
  touches: { ONE: number; TWO: number };
  keys: { LEFT: string; RIGHT: string; UP: string; BOTTOM: string };
  addEventListener: jest.Mock;
  listenToKeyEvents: jest.Mock;
  getDistance: jest.Mock;
  getPolarAngle: jest.Mock;
  getAzimuthalAngle: jest.Mock;
  target: THREE.Vector3;
  update: jest.Mock;
  minPolarAngle: number;
  maxPolarAngle: number;
};

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: undefined,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

jest.mock("three/examples/jsm/libs/draco/draco_decoder.wasm", () => "");

jest.mock("three/examples/jsm/controls/OrbitControls", () => ({
  OrbitControls: jest.fn().mockImplementation(() => mockOrbitControls),
}));

jest.mock("three", () => {
  const ActualTHREE = jest.requireActual("three");
  return {
    ...ActualTHREE,
    WebGLRenderer: function WebGLRenderer() {
      return {
        capabilities: {
          isWebGL2: true,
        },
        setPixelRatio: jest.fn(),
        setSize: jest.fn(),
        render: jest.fn(),
        clear: jest.fn(),
        setClearColor: jest.fn(),
        readRenderTargetPixels: jest.fn(),
        info: {
          reset: jest.fn(),
        },
        shadowMap: {},
        dispose: jest.fn(),
        clearDepth: jest.fn(),
        getDrawingBufferSize: () => ({ width: 100, height: 100 }),
      };
    },
  };
});

function setupOrbitControlsMock() {
  mockOrbitControls = {
    ...DEFAULT_ORBIT_CONTROLS_CONFIG,
    addEventListener: jest.fn(),
    listenToKeyEvents: jest.fn(),
    getDistance: jest.fn().mockReturnValue(DEFAULT_CAMERA_STATE.distance),
    getPolarAngle: jest.fn().mockReturnValue(THREE.MathUtils.degToRad(DEFAULT_CAMERA_STATE.phi)),
    getAzimuthalAngle: jest
      .fn()
      .mockReturnValue(THREE.MathUtils.degToRad(-DEFAULT_CAMERA_STATE.thetaOffset)),
    target: new THREE.Vector3(...DEFAULT_CAMERA_STATE.targetOffset),
    update: jest.fn(),
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
  };
}

const defaultRendererConfig: RendererConfig = {
  cameraState: DEFAULT_CAMERA_STATE,
  followMode: "follow-pose",
  followTf: undefined,
  scene: {},
  transforms: {},
  topics: {},
  layers: {},
  publish: DEFAULT_PUBLISH_SETTINGS,
  imageMode: {},
};

const fetchAsset = async (uri: string, options?: { signal?: AbortSignal }): Promise<Asset> => {
  const response = await fetch(uri, options);
  return {
    uri,
    data: new Uint8Array(await response.arrayBuffer()),
    mediaType: response.headers.get("content-type") ?? undefined,
  };
};

const defaultRendererProps = {
  config: defaultRendererConfig,
  interfaceMode: "3d" as const,
  fetchAsset,
  sceneExtensionConfig: DEFAULT_SCENE_EXTENSION_CONFIG,
  testOptions: {},
  customCameraModels: new Map(),
};

describe("CameraStateSettings", () => {
  let canvas: HTMLCanvasElement;
  let parent: HTMLDivElement;
  let renderer: Renderer;

  beforeEach(() => {
    jest.clearAllMocks();
    setupJestCanvasMock();
    setupOrbitControlsMock();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    renderer = new Renderer({ ...defaultRendererProps, canvas });
  });

  afterEach(() => {
    renderer.dispose();
    (console.warn as jest.Mock).mockClear(); // Suppress warnings from the Renderer during tests, if any
  });

  describe("constructor", () => {
    it("creates an instance with correct default settings", () => {
      // Given
      const aspect = 16 / 9;

      // When
      const cameraStateSettings = new CameraStateSettings(renderer, canvas, aspect);
      cameraStateSettings.setCameraState(DEFAULT_CAMERA_STATE);

      // Then
      expect(cameraStateSettings).toBeInstanceOf(CameraStateSettings);
      expect(cameraStateSettings.getActiveCamera().type).toBe("PerspectiveCamera");
      expect(cameraStateSettings.getCameraState()).toMatchObject({
        ...DEFAULT_CAMERA_STATE,
        distance: expect.closeTo(DEFAULT_CAMERA_STATE.distance), // floating point comparisons
        phi: expect.closeTo(DEFAULT_CAMERA_STATE.phi),
        thetaOffset: expect.closeTo(DEFAULT_CAMERA_STATE.thetaOffset),
      });
      expect(cameraStateSettings.settingsNodes()).toHaveLength(2);
    });
  });

  describe("screen space panning", () => {
    const aspect = 16 / 9;

    it("defaults to screen space panning disabled", () => {
      // Given: A newly constructed CameraStateSettings instance
      new CameraStateSettings(renderer, canvas, aspect);

      // Then: Screen space panning should be disabled by default
      expect(mockOrbitControls.screenSpacePanning).toBe(false);
    });

    it("enables screen space panning when Alt key is held", () => {
      // Given: A CameraStateSettings instance with canvas keyboard listeners attached
      new CameraStateSettings(renderer, canvas, aspect);

      // When: A keydown event fires with the Alt key held
      canvas.dispatchEvent(new KeyboardEvent("keydown", { altKey: true, bubbles: true }));

      // Then: Screen space panning should be enabled
      expect(mockOrbitControls.screenSpacePanning).toBe(true);
    });

    it("disables screen space panning when Alt key is released", () => {
      // Given: A CameraStateSettings instance with Alt key already held
      new CameraStateSettings(renderer, canvas, aspect);
      canvas.dispatchEvent(new KeyboardEvent("keydown", { altKey: true, bubbles: true }));

      // When: A keyup event fires without the Alt key
      canvas.dispatchEvent(new KeyboardEvent("keyup", { altKey: false, bubbles: true }));

      // Then: Screen space panning should be disabled again
      expect(mockOrbitControls.screenSpacePanning).toBe(false);
    });

    it("does not enable screen space panning on keydown without Alt", () => {
      // Given: A CameraStateSettings instance with canvas keyboard listeners attached
      new CameraStateSettings(renderer, canvas, aspect);

      // When: A keydown event fires without the Alt key
      canvas.dispatchEvent(new KeyboardEvent("keydown", { altKey: false, bubbles: true }));

      // Then: Screen space panning should remain disabled
      expect(mockOrbitControls.screenSpacePanning).toBe(false);
    });
  });
});
