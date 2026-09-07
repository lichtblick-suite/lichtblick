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
import { DEFAULT_LABEL_SCALE_FACTOR, SceneSettings } from "./SceneSettings";

// --- OrbitControls mock ---

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

// --- WebGLRenderer mock ---
// Prefixed with "mock" so Jest's module-factory scope check allows the reference.

let mockGl: {
  toneMapping: THREE.ToneMapping;
  shadowMap: { enabled: boolean };
  capabilities: { isWebGL2: boolean };
  setPixelRatio: jest.Mock;
  setSize: jest.Mock;
  render: jest.Mock;
  clear: jest.Mock;
  setClearColor: jest.Mock;
  readRenderTargetPixels: jest.Mock;
  info: { reset: jest.Mock };
  dispose: jest.Mock;
  clearDepth: jest.Mock;
  getDrawingBufferSize: () => { width: number; height: number };
};

function resetMockGl() {
  mockGl = {
    toneMapping: THREE.NoToneMapping,
    shadowMap: { enabled: false },
    capabilities: { isWebGL2: true },
    setPixelRatio: jest.fn(),
    setSize: jest.fn(),
    render: jest.fn(),
    clear: jest.fn(),
    setClearColor: jest.fn(),
    readRenderTargetPixels: jest.fn(),
    info: { reset: jest.fn() },
    dispose: jest.fn(),
    clearDepth: jest.fn(),
    getDrawingBufferSize: () => ({ width: 100, height: 100 }),
  };
}

// --- Jest module mocks ---

jest.mock("three/examples/jsm/libs/draco/draco_decoder.wasm", () => "");

jest.mock("three/examples/jsm/controls/OrbitControls", () => ({
  OrbitControls: jest.fn().mockImplementation(() => mockOrbitControls),
}));

jest.mock("three", () => {
  const ActualTHREE = jest.requireActual("three");
  return {
    ...ActualTHREE,
    WebGLRenderer: function WebGLRenderer() {
      return mockGl;
    },
  };
});

// --- Shared beforeEach setup ---

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
  resetMockGl();
  setupOrbitControlsMock();
  setupJestCanvasMock();
});

// --- Test helpers ---

const fetchAsset = async (uri: string, options?: { signal?: AbortSignal }): Promise<Asset> => {
  const response = await fetch(uri, options);
  return {
    uri,
    data: new Uint8Array(await response.arrayBuffer()),
    mediaType: response.headers.get("content-type") ?? undefined,
  };
};

function makeDefaultConfig(sceneOverrides: Partial<RendererConfig["scene"]> = {}): RendererConfig {
  return {
    cameraState: DEFAULT_CAMERA_STATE,
    followMode: "follow-pose",
    followTf: undefined,
    scene: sceneOverrides,
    transforms: {},
    topics: {},
    layers: {},
    publish: DEFAULT_PUBLISH_SETTINGS,
    imageMode: {},
  };
}

function makeRenderer(config: RendererConfig = makeDefaultConfig()): Renderer {
  const parent = document.createElement("div");
  const canvas = document.createElement("canvas");
  parent.appendChild(canvas);
  return new Renderer({
    config,
    interfaceMode: "3d",
    fetchAsset,
    sceneExtensionConfig: DEFAULT_SCENE_EXTENSION_CONFIG,
    testOptions: {},
    customCameraModels: new Map(),
    canvas,
  });
}

// --- Tests ---
// All describe blocks include afterEach(() => { (console.warn as jest.Mock).mockClear() })
// so they run before the framework-level check (inner describe afterEach runs before outer).

describe("SceneSettings — settingsNodes", () => {
  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("includes the three new lighting fields in the settings tree", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);

    const [entry] = sceneSettings.settingsNodes();
    const fieldKeys = Object.keys(entry?.node.fields ?? {});

    expect(fieldKeys).toContain("mainLightMode");
    expect(fieldKeys).toContain("directionalLightIntensity");
    expect(fieldKeys).toContain("hemisphereLightIntensity");

    renderer.dispose();
  });

  it("shows 'fixed' as the default mainLightMode value", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);

    const [entry] = sceneSettings.settingsNodes();
    const field = entry?.node.fields?.mainLightMode;

    expect(field).toMatchObject({ input: "select", value: "fixed" });
    renderer.dispose();
  });

  it("omits the debugPicking field in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const renderer = makeRenderer();
      const sceneSettings = new SceneSettings(renderer);

      const [entry] = sceneSettings.settingsNodes();
      const fieldKeys = Object.keys(entry?.node.fields ?? {});

      expect(fieldKeys).not.toContain("debugPicking");
      renderer.dispose();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe("SceneSettings — handleSettingsAction", () => {
  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("calls updateSceneRenderSettings when mainLightMode changes", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const spy = jest.spyOn(renderer, "updateSceneRenderSettings");

    sceneSettings.handleSettingsAction({
      action: "update",
      payload: { path: ["scene", "mainLightMode"], value: "headlight", input: "select" },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    renderer.dispose();
  });

  it.each([
    "directionalLightIntensity",
    "hemisphereLightIntensity",
  ] as const)("calls updateSceneRenderSettings when number field '%s' changes", (settingKey) => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const spy = jest.spyOn(renderer, "updateSceneRenderSettings");

    sceneSettings.handleSettingsAction({
      action: "update",
      payload: { path: ["scene", settingKey], value: 2, input: "number" },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    renderer.dispose();
  });

  it("calls updateSceneRenderSettings on reset-scene action", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const spy = jest.spyOn(renderer, "updateSceneRenderSettings");

    sceneSettings.handleSettingsAction({
      action: "perform-node-action",
      payload: { id: "reset-scene", path: ["scene"] },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    renderer.dispose();
  });

  it("resets labelPool scale factor on reset-scene action", () => {
    const renderer = makeRenderer(makeDefaultConfig({ labelScaleFactor: 3 }));
    const sceneSettings = new SceneSettings(renderer);
    const setScaleSpy = jest.spyOn(renderer.labelPool, "setScaleFactor");

    sceneSettings.handleSettingsAction({
      action: "perform-node-action",
      payload: { id: "reset-scene", path: ["scene"] },
    });

    expect(setScaleSpy).toHaveBeenCalledWith(DEFAULT_LABEL_SCALE_FACTOR);
    renderer.dispose();
  });

  it("ignores actions that are not 'update' and not the reset-scene node-action", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const updateConfigSpy = jest.spyOn(renderer, "updateConfig");

    sceneSettings.handleSettingsAction({
      action: "perform-node-action",
      payload: { id: "some-other-action", path: ["scene"] },
    });

    expect(updateConfigSpy).not.toHaveBeenCalled();
    renderer.dispose();
  });

  it("ignores update actions with an empty path", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const updateConfigSpy = jest.spyOn(renderer, "updateConfig");

    sceneSettings.handleSettingsAction({
      action: "update",
      payload: { path: [], value: "anything", input: "string" },
    });

    expect(updateConfigSpy).not.toHaveBeenCalled();
    renderer.dispose();
  });

  it("ignores update actions outside the 'scene' category", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const updateConfigSpy = jest.spyOn(renderer, "updateConfig");

    sceneSettings.handleSettingsAction({
      action: "update",
      payload: { path: ["transforms", "someField"], value: "anything", input: "string" },
    });

    expect(updateConfigSpy).not.toHaveBeenCalled();
    renderer.dispose();
  });

  it("updates debugPicking directly without touching the renderer config", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const updateConfigSpy = jest.spyOn(renderer, "updateConfig");

    sceneSettings.handleSettingsAction({
      action: "update",
      payload: { path: ["scene", "debugPicking"], value: true, input: "boolean" },
    });

    expect(renderer.debugPicking).toBe(true);
    expect(updateConfigSpy).not.toHaveBeenCalled();
    renderer.dispose();
  });

  it("updates the background color scheme when backgroundColor changes", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const setColorSchemeSpy = jest.spyOn(renderer, "setColorScheme");

    sceneSettings.handleSettingsAction({
      action: "update",
      payload: { path: ["scene", "backgroundColor"], value: "#123456", input: "rgb" },
    });

    expect(setColorSchemeSpy).toHaveBeenCalledWith(renderer.colorScheme, "#123456");
    renderer.dispose();
  });

  it("updates the label pool scale factor when labelScaleFactor changes", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const setScaleSpy = jest.spyOn(renderer.labelPool, "setScaleFactor");

    sceneSettings.handleSettingsAction({
      action: "update",
      payload: { path: ["scene", "labelScaleFactor"], value: 2.5, input: "number" },
    });

    expect(setScaleSpy).toHaveBeenCalledWith(2.5);
    renderer.dispose();
  });

  it("falls back to the default label scale factor when labelScaleFactor is cleared", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const setScaleSpy = jest.spyOn(renderer.labelPool, "setScaleFactor");

    sceneSettings.handleSettingsAction({
      action: "update",
      payload: { path: ["scene", "labelScaleFactor"], value: undefined, input: "number" },
    });

    expect(setScaleSpy).toHaveBeenCalledWith(DEFAULT_LABEL_SCALE_FACTOR);
    renderer.dispose();
  });
});
