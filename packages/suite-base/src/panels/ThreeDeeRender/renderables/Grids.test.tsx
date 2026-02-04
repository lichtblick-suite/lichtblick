/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { setupJestCanvasMock } from "jest-canvas-mock";

import { SettingsTreeAction } from "@lichtblick/suite";
import { Asset } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { Renderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/Renderer";
import { DEFAULT_SCENE_EXTENSION_CONFIG } from "@lichtblick/suite-base/panels/ThreeDeeRender/SceneExtensionConfig";
import { DEFAULT_CAMERA_STATE } from "@lichtblick/suite-base/panels/ThreeDeeRender/camera";
import { DEFAULT_PUBLISH_SETTINGS } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/PublishSettings";
import { BasicBuilder } from "@lichtblick/test-builders";

import { RendererConfig } from "../IRenderer";
import { Grids } from "./Grids";

jest.mock("three/examples/jsm/libs/draco/draco_decoder.wasm", () => "");

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

describe("Grids", () => {
  let canvas: HTMLCanvasElement;
  let parent: HTMLDivElement;
  let renderer: Renderer;

  beforeEach(() => {
    jest.clearAllMocks();
    setupJestCanvasMock();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    renderer = new Renderer({ ...defaultRendererProps, canvas });
  });

  afterEach(() => {
    renderer.dispose();
    (console.warn as jest.Mock).mockClear();
  });

  describe("handleSettingsAction() - reorder-node action", () => {
    const layerGridId = "foxglove.Grid";
    const layerGrids = "foxglove.Grids";
    it("should return early and not modify config when reorder-node action is received", () => {
      // Given: A Grids extension with an existing grid layer
      const grids = renderer.sceneExtensions.get(layerGrids) as Grids;
      const instanceId = BasicBuilder.string();

      // Add a grid layer to the config
      renderer.updateConfig((draft) => {
        draft.layers[instanceId] = {
          layerId: layerGridId,
          instanceId,
          visible: true,
          label: BasicBuilder.string(),
          order: 1,
        };
      });

      const updateConfigSpy = jest.spyOn(renderer, "updateConfig");
      const updateSettingsTreeSpy = jest.spyOn(grids, "updateSettingsTree");

      const action: SettingsTreeAction = {
        action: "reorder-node",
        payload: {
          path: ["layers", instanceId],
          targetPath: ["layers", instanceId],
        },
      };

      // When: Handling a reorder-node action
      grids.handleSettingsAction(action);

      // Then: Config should not be updated
      expect(updateConfigSpy).not.toHaveBeenCalled();
      // And: Settings tree should not be updated
      expect(updateSettingsTreeSpy).not.toHaveBeenCalled();
    });

    it("should not process any settings updates when reorder-node action is triggered", () => {
      // Given: A Grids extension with multiple grid layers
      const grids = renderer.sceneExtensions.get(layerGrids) as Grids;
      const instanceId1 = BasicBuilder.string();
      const instanceId2 = BasicBuilder.string();

      renderer.updateConfig((draft) => {
        draft.layers[instanceId1] = {
          layerId: layerGridId,
          instanceId: instanceId1,
          visible: true,
          label: "Grid 1",
          order: 1,
        };
        draft.layers[instanceId2] = {
          layerId: layerGridId,
          instanceId: instanceId2,
          visible: true,
          label: "Grid 2",
          order: 2,
        };
      });

      const saveSettingSpy = jest.spyOn(grids as any, "saveSetting");

      const action: SettingsTreeAction = {
        action: "reorder-node",
        payload: {
          path: ["layers", instanceId1, "size"],
          targetPath: ["layers", instanceId1, "size"],
        },
      };

      // When: Handling a reorder-node action with a field path
      grids.handleSettingsAction(action);

      // Then: saveSetting should not be called
      expect(saveSettingSpy).not.toHaveBeenCalled();
    });

    it("should not delete renderables when reorder-node action is triggered", () => {
      // Given: A Grids extension with an existing grid layer and renderable
      const grids = renderer.sceneExtensions.get(layerGrids) as Grids;
      const instanceId = BasicBuilder.string();

      renderer.updateConfig((draft) => {
        draft.layers[instanceId] = {
          layerId: layerGridId,
          instanceId,
          visible: true,
          label: BasicBuilder.string(),
          order: 1,
        };
      });

      // Trigger settings tree update to create renderables
      grids.updateSettingsTree();

      const initialRenderableCount = grids.renderables.size;
      const renderable = grids.renderables.get(instanceId);

      const action: SettingsTreeAction = {
        action: "reorder-node",
        payload: {
          path: ["layers", instanceId],
          targetPath: ["layers", instanceId],
        },
      };

      // When: Handling a reorder-node action
      grids.handleSettingsAction(action);

      // Then: Renderables count should remain the same
      expect(grids.renderables.size).toBe(initialRenderableCount);
      // And: The specific renderable should still exist
      expect(grids.renderables.get(instanceId)).toBe(renderable);
    });

    it("should immediately return without processing any logic for reorder-node action", () => {
      // Given: A Grids extension with an existing grid layer
      const grids = renderer.sceneExtensions.get(layerGrids) as Grids;
      const instanceId = BasicBuilder.string();

      renderer.updateConfig((draft) => {
        draft.layers[instanceId] = {
          layerId: layerGridId,
          instanceId,
          visible: true,
          label: BasicBuilder.string(),
          order: 1,
        };
      });

      const saveSettingSpy = jest.spyOn(grids as any, "saveSetting");
      const updateConfigSpy = jest.spyOn(renderer, "updateConfig");

      const action: SettingsTreeAction = {
        action: "reorder-node",
        payload: {
          path: ["layers", instanceId, "size"],
          targetPath: ["layers", instanceId, "size"],
        },
      };

      // When: Handling a reorder-node action
      grids.handleSettingsAction(action);

      // Then: saveSetting should not be called
      expect(saveSettingSpy).not.toHaveBeenCalled();
      // And: updateConfig should not be called
      expect(updateConfigSpy).not.toHaveBeenCalled();
    });

    it("should preserve layer order information when reorder-node action is received", () => {
      // Given: A Grids extension with layers having specific order values
      const grids = renderer.sceneExtensions.get(layerGrids) as Grids;
      const instanceId1 = "grid-1";
      const instanceId2 = "grid-2";
      const instanceId3 = "grid-3";

      renderer.updateConfig((draft) => {
        draft.layers[instanceId1] = {
          layerId: layerGridId,
          instanceId: instanceId1,
          visible: true,
          label: "Grid 1",
          order: 1,
        };
        draft.layers[instanceId2] = {
          layerId: layerGridId,
          instanceId: instanceId2,
          visible: true,
          label: "Grid 2",
          order: 2,
        };
        draft.layers[instanceId3] = {
          layerId: layerGridId,
          instanceId: instanceId3,
          visible: true,
          label: "Grid 3",
          order: 3,
        };
      });

      const initialOrder1 = renderer.config.layers[instanceId1]?.order;
      const initialOrder2 = renderer.config.layers[instanceId2]?.order;
      const initialOrder3 = renderer.config.layers[instanceId3]?.order;

      const action: SettingsTreeAction = {
        action: "reorder-node",
        payload: {
          path: ["layers", instanceId2],
          targetPath: ["layers", instanceId2],
        },
      };

      // When: Handling a reorder-node action
      grids.handleSettingsAction(action);

      // Then: All layer order values should remain unchanged
      expect(renderer.config.layers[instanceId1]?.order).toBe(initialOrder1);
      expect(renderer.config.layers[instanceId2]?.order).toBe(initialOrder2);
      expect(renderer.config.layers[instanceId3]?.order).toBe(initialOrder3);
    });
  });
});
