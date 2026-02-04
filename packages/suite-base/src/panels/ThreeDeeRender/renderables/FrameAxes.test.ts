/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { setupJestCanvasMock } from "jest-canvas-mock";
import * as THREE from "three";

import { SettingsTreeAction } from "@lichtblick/suite";
import { Asset } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { Renderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/Renderer";
import { DEFAULT_SCENE_EXTENSION_CONFIG } from "@lichtblick/suite-base/panels/ThreeDeeRender/SceneExtensionConfig";
import { DEFAULT_CAMERA_STATE } from "@lichtblick/suite-base/panels/ThreeDeeRender/camera";
import { DEFAULT_PUBLISH_SETTINGS } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/PublishSettings";

import { RendererConfig } from "../IRenderer";
import { FrameAxes } from "./FrameAxes";

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

describe("FrameAxes", () => {
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

  describe("details()", () => {
    it("returns frame details with parent and fixed frame", () => {
      // Given: A frame with a parent
      const parentFrame = renderer.transformTree.getOrCreateFrame("parent");
      const childFrame = renderer.transformTree.getOrCreateFrame("child");
      childFrame.setParent(parentFrame);

      // Trigger transform tree update to create renderables
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const renderable = frameAxes.renderables.get("child");

      // When: Getting details
      const details = renderable?.details();

      // Then: Should contain frame information
      expect(details).toBeDefined();
      expect(details?.child_frame_id).toBe("child");
      expect(details?.parent_frame_id).toBe("parent");
      expect(details?.fixed_frame_id).toBe("parent");
    });
  });

  describe("dispose()", () => {
    it("releases label back to pool when disposed", () => {
      // Given: A frame axis with a label
      renderer.transformTree.getOrCreateFrame("test_frame");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const renderable = frameAxes.renderables.get("test_frame");
      const label = renderable?.userData.label;

      const releaseSpy = jest.spyOn(renderer.labelPool, "release");

      // When: Disposing the renderable
      renderable?.dispose();

      // Then: Label should be released
      expect(releaseSpy).toHaveBeenCalledWith(label);
    });
  });

  describe("setColorScheme()", () => {
    it("sets labels to white foreground on dark background for dark theme", () => {
      // Given: FrameAxes extension with a frame
      renderer.transformTree.getOrCreateFrame("test_frame");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const renderable = frameAxes.renderables.get("test_frame");
      const label = renderable?.userData.label;

      const setColorSpy = jest.spyOn(label!, "setColor");
      const setBackgroundSpy = jest.spyOn(label!, "setBackgroundColor");

      // When: Setting dark color scheme
      frameAxes.setColorScheme("dark", undefined);

      // Then: Should set white text (1, 1, 1) on black background (0, 0, 0)
      expect(setColorSpy).toHaveBeenCalledWith(1, 1, 1);
      expect(setBackgroundSpy).toHaveBeenCalledWith(0, 0, 0);
    });

    it("sets labels to black foreground on white background for light theme", () => {
      // Given: FrameAxes extension with a frame
      renderer.transformTree.getOrCreateFrame("test_frame");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const renderable = frameAxes.renderables.get("test_frame");
      const label = renderable?.userData.label;

      const setColorSpy = jest.spyOn(label!, "setColor");
      const setBackgroundSpy = jest.spyOn(label!, "setBackgroundColor");

      // When: Setting light color scheme
      frameAxes.setColorScheme("light", undefined);

      // Then: Should set black text (0, 0, 0) on white background (1, 1, 1)
      expect(setColorSpy).toHaveBeenCalledWith(0, 0, 0);
      expect(setBackgroundSpy).toHaveBeenCalledWith(1, 1, 1);
    });

    it("adjusts foreground color based on custom background luminance", () => {
      // Given: FrameAxes extension with a frame
      renderer.transformTree.getOrCreateFrame("test_frame");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const renderable = frameAxes.renderables.get("test_frame");
      const label = renderable?.userData.label;

      const setColorSpy = jest.spyOn(label!, "setColor");
      const darkBackground = new THREE.Color(0.1, 0.1, 0.1); // Dark background

      // When: Setting color scheme with dark custom background
      frameAxes.setColorScheme("dark", darkBackground);

      // Then: Should use white foreground for dark background
      expect(setColorSpy).toHaveBeenCalledWith(1, 1, 1);
    });
  });

  describe("handleSettingsAction()", () => {
    it("returns early for reorder-node without updating frame offsets", () => {
      // Given: FrameAxes with a frame that has editable settings enabled
      renderer.updateConfig((draft) => {
        draft.scene.transforms = { editable: true };
        draft.transforms["frame:test_frame"] = { xyzOffset: [1, 2, 3] };
      });
      renderer.transformTree.getOrCreateFrame("test_frame");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const frame = renderer.transformTree.frame("test_frame");

      // Verify initial state has offset
      expect(frame?.offsetPosition).toEqual([1, 2, 3]);

      // When: Sending reorder-node action that would change xyzOffset if processed
      const reorderAction: SettingsTreeAction = {
        action: "reorder-node",
        payload: {
          path: ["transforms", "frame:test_frame", "xyzOffset"],
          targetPath: ["transforms", "frame:test_frame"],
        },
      };
      frameAxes.handleSettingsAction(reorderAction);

      // Then: Frame offset remains unchanged (early return prevented processing)
      expect(frame?.offsetPosition).toEqual([1, 2, 3]);
      expect(renderer.config.transforms["frame:test_frame"]?.xyzOffset).toEqual([1, 2, 3]);
    });

    it("does not call saveSetting or update axis scale for reorder-node action", () => {
      // Given: FrameAxes with a specific axis scale
      renderer.updateConfig((draft) => {
        draft.scene.transforms = { axisScale: 2.5 };
      });
      renderer.transformTree.getOrCreateFrame("test_frame");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const renderable = frameAxes.renderables.get("test_frame");

      // Verify initial scale
      expect(renderable?.userData.axis.scale.x).toBe(2.5);

      // When: Sending reorder-node for settings path that would change axisScale
      const reorderAction: SettingsTreeAction = {
        action: "reorder-node",
        payload: {
          path: ["transforms", "settings", "axisScale"],
          targetPath: ["transforms", "settings"],
        },
      };
      frameAxes.handleSettingsAction(reorderAction);

      // Then: Axis scale remains unchanged (early return prevented saveSetting and setAxisScale)
      expect(renderable?.userData.axis.scale.x).toBe(2.5);
      expect(renderer.config.scene.transforms?.axisScale).toBe(2.5);
    });

    it("does not call updateConfig or toggle visibility for reorder-node action", () => {
      // Given: FrameAxes with mixed visibility states
      renderer.updateConfig((draft) => {
        draft.transforms["frame:frame1"] = { visible: true };
        draft.transforms["frame:frame2"] = { visible: false };
      });
      renderer.transformTree.getOrCreateFrame("frame1");
      renderer.transformTree.getOrCreateFrame("frame2");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const renderable1 = frameAxes.renderables.get("frame1");
      const renderable2 = frameAxes.renderables.get("frame2");

      // Verify initial visibility states
      expect(renderable1?.userData.settings.visible).toBe(true);
      expect(renderable2?.userData.settings.visible).toBe(false);

      // When: Sending reorder-node that would normally flip a visibility value
      const reorderAction: SettingsTreeAction = {
        action: "reorder-node",
        payload: {
          path: ["transforms", "frame:frame2", "visible"],
          targetPath: ["transforms", "frame:frame2"],
        },
      };
      frameAxes.handleSettingsAction(reorderAction);

      // Then: Visibility states remain unchanged (early return prevented processing)
      expect(renderable1?.userData.settings.visible).toBe(true);
      expect(renderable2?.userData.settings.visible).toBe(false);
      expect(renderer.config.transforms["frame:frame2"]?.visible).toBe(false);
    });

    it("shows all frames when show-all action is triggered", () => {
      // Given: FrameAxes extension with multiple frames
      renderer.transformTree.getOrCreateFrame("frame1");
      renderer.transformTree.getOrCreateFrame("frame2");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "show-all",
          path: ["transforms"],
        },
      };

      // When: Triggering show-all action
      frameAxes.handleSettingsAction(action);

      // Then: All renderables should be visible
      for (const renderable of frameAxes.renderables.values()) {
        expect(renderable.userData.settings.visible).toBe(true);
      }
    });

    it("hides all frames when hide-all action is triggered", () => {
      // Given: FrameAxes extension with multiple frames
      renderer.transformTree.getOrCreateFrame("frame1");
      renderer.transformTree.getOrCreateFrame("frame2");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;

      const action: SettingsTreeAction = {
        action: "perform-node-action",
        payload: {
          id: "hide-all",
          path: ["transforms"],
        },
      };

      // When: Triggering hide-all action
      frameAxes.handleSettingsAction(action);

      // Then: All renderables should be hidden
      for (const renderable of frameAxes.renderables.values()) {
        expect(renderable.userData.settings.visible).toBe(false);
      }
    });

    it("updates label size when labelSize setting is changed", () => {
      // Given: FrameAxes extension with a frame
      renderer.transformTree.getOrCreateFrame("test_frame");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const renderable = frameAxes.renderables.get("test_frame");
      const label = renderable?.userData.label;

      const setLineHeightSpy = jest.spyOn(label!, "setLineHeight");

      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["transforms", "settings", "labelSize"],
          value: 0.5,
          input: "number",
        },
      };

      // When: Changing label size
      frameAxes.handleSettingsAction(action);

      // Then: Label line height should be updated
      expect(setLineHeightSpy).toHaveBeenCalledWith(0.5);
    });

    it("updates axis scale when axisScale setting is changed", () => {
      // Given: FrameAxes extension with a frame
      renderer.transformTree.getOrCreateFrame("test_frame");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;
      const renderable = frameAxes.renderables.get("test_frame");
      const axis = renderable?.userData.axis;
      const scaleSpy = jest.spyOn(axis!.scale, "set");

      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["transforms", "settings", "axisScale"],
          value: 2.0,
          input: "number",
        },
      };

      // When: Changing axis scale
      frameAxes.handleSettingsAction(action);

      // Then: Scale should be set to 2.0 for all axes
      expect(scaleSpy).toHaveBeenCalledWith(2.0, 2.0, 2.0);
    });

    it("updates frame visibility when visible setting is changed", () => {
      // Given: FrameAxes extension with a frame
      renderer.transformTree.getOrCreateFrame("test_frame");
      renderer.emit("transformTreeUpdated", renderer);

      const frameAxes = renderer.sceneExtensions.get("foxglove.FrameAxes") as FrameAxes;

      const action: SettingsTreeAction = {
        action: "update",
        payload: {
          path: ["transforms", "frame:test_frame", "visible"],
          value: false,
          input: "boolean",
        },
      };

      // When: Changing frame visibility
      frameAxes.handleSettingsAction(action);

      // Then: Config should be updated
      expect(renderer.config.transforms["frame:test_frame"]?.visible).toBe(false);
    });
  });
});
