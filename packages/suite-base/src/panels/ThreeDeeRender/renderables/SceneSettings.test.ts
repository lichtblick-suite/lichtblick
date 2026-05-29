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

  it("includes the five new lighting fields in the settings tree", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);

    const [entry] = sceneSettings.settingsNodes();
    const fieldKeys = Object.keys(entry?.node.fields ?? {});

    expect(fieldKeys).toContain("mainLightMode");
    expect(fieldKeys).toContain("directionalLightIntensity");
    expect(fieldKeys).toContain("hemisphereLightIntensity");
    expect(fieldKeys).toContain("shadowsEnabled");
    expect(fieldKeys).toContain("toneMapping");

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

  it("reflects the configured toneMapping value", () => {
    const renderer = makeRenderer(makeDefaultConfig({ toneMapping: "aces" }));
    const sceneSettings = new SceneSettings(renderer);

    const [entry] = sceneSettings.settingsNodes();
    const field = entry?.node.fields?.toneMapping;

    expect(field).toMatchObject({ input: "select", value: "aces" });
    renderer.dispose();
  });
});

describe("SceneSettings — handleSettingsAction", () => {
  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it.each(["mainLightMode", "toneMapping"] as const)(
    "calls updateSceneRenderSettings when select field '%s' changes",
    (settingKey) => {
      const renderer = makeRenderer();
      const sceneSettings = new SceneSettings(renderer);
      const spy = jest.spyOn(renderer, "updateSceneRenderSettings");

      sceneSettings.handleSettingsAction({
        action: "update",
        payload: { path: ["scene", settingKey], value: "headlight", input: "select" },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      renderer.dispose();
    },
  );

  it.each(["directionalLightIntensity", "hemisphereLightIntensity"] as const)(
    "calls updateSceneRenderSettings when number field '%s' changes",
    (settingKey) => {
      const renderer = makeRenderer();
      const sceneSettings = new SceneSettings(renderer);
      const spy = jest.spyOn(renderer, "updateSceneRenderSettings");

      sceneSettings.handleSettingsAction({
        action: "update",
        payload: { path: ["scene", settingKey], value: 2, input: "number" },
      });

      expect(spy).toHaveBeenCalledTimes(1);
      renderer.dispose();
    },
  );

  it("calls updateSceneRenderSettings when shadowsEnabled changes", () => {
    const renderer = makeRenderer();
    const sceneSettings = new SceneSettings(renderer);
    const spy = jest.spyOn(renderer, "updateSceneRenderSettings");

    sceneSettings.handleSettingsAction({
      action: "update",
      payload: { path: ["scene", "shadowsEnabled"], value: true, input: "boolean" },
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
});

describe("Renderer.updateSceneRenderSettings", () => {
  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("defaults to NoToneMapping when toneMapping is not configured", () => {
    const renderer = makeRenderer();
    expect(renderer.gl.toneMapping).toBe(THREE.NoToneMapping);
    renderer.dispose();
  });

  it("applies ACESFilmicToneMapping when toneMapping is 'aces'", () => {
    const renderer = makeRenderer(makeDefaultConfig({ toneMapping: "aces" }));
    expect(renderer.gl.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    renderer.dispose();
  });

  it("reverts to NoToneMapping when updateSceneRenderSettings is called after changing toneMapping to 'none'", () => {
    const renderer = makeRenderer(makeDefaultConfig({ toneMapping: "aces" }));
    renderer.updateConfig((draft) => {
      draft.scene.toneMapping = "none";
    });
    renderer.updateSceneRenderSettings();
    expect(renderer.gl.toneMapping).toBe(THREE.NoToneMapping);
    renderer.dispose();
  });

  it("defaults shadows to disabled", () => {
    const renderer = makeRenderer();
    expect(renderer.gl.shadowMap.enabled).toBe(false);
    renderer.dispose();
  });

  it("enables shadow map when shadowsEnabled is true", () => {
    const renderer = makeRenderer(makeDefaultConfig({ shadowsEnabled: true }));
    expect(renderer.gl.shadowMap.enabled).toBe(true);
    renderer.dispose();
  });

  it("disables shadow map after updateSceneRenderSettings is called with shadowsEnabled false", () => {
    const renderer = makeRenderer(makeDefaultConfig({ shadowsEnabled: true }));
    renderer.updateConfig((draft) => {
      draft.scene.shadowsEnabled = false;
    });
    renderer.updateSceneRenderSettings();
    expect(renderer.gl.shadowMap.enabled).toBe(false);
    renderer.dispose();
  });
});
