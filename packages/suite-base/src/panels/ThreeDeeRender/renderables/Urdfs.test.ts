/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { waitFor } from "@testing-library/react";
import { setupJestCanvasMock } from "jest-canvas-mock";
import * as THREE from "three";

import { MessageEvent } from "@lichtblick/suite";
import { Renderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/Renderer";
import { DEFAULT_SCENE_EXTENSION_CONFIG } from "@lichtblick/suite-base/panels/ThreeDeeRender/SceneExtensionConfig";
import {
  DEFAULT_CAMERA_STATE,
  DEFAULT_ORBIT_CONTROLS_CONFIG,
} from "@lichtblick/suite-base/panels/ThreeDeeRender/camera";
import { DEFAULT_PUBLISH_SETTINGS } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/PublishSettings";

import { RendererConfig } from "../IRenderer";
import { LayerSettingsCustomUrdf, LayerSettingsUrdf, UrdfRenderable, Urdfs } from "./Urdfs";
import { MarkerUserData } from "./markers/RenderableMarker";

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
        capabilities: { isWebGL2: true },
        setPixelRatio: jest.fn(),
        setSize: jest.fn(),
        render: jest.fn(),
        clear: jest.fn(),
        setClearColor: jest.fn(),
        readRenderTargetPixels: jest.fn(),
        info: { reset: jest.fn() },
        shadowMap: {},
        dispose: jest.fn(),
        clearDepth: jest.fn(),
        getDrawingBufferSize: () => ({ width: 100, height: 100 }),
      };
    },
  };
});

const URDF = `<?xml version="1.0"?>
<robot name="opacity-test">
  <link name="box">
    <visual>
      <geometry><box size="1 1 1"/></geometry>
      <material><color rgba="1 0 0 0.8"/></material>
    </visual>
  </link>
</robot>`;

const SHAPES_URDF = `<?xml version="1.0"?>
<robot name="shapes-test">
  <link name="base">
    <visual>
      <geometry><cylinder radius="0.5" length="1.0"/></geometry>
      <material><color rgba="1 0 0 0.8"/></material>
    </visual>
    <visual>
      <geometry><sphere radius="0.3"/></geometry>
      <material><color rgba="0 1 0 1.0"/></material>
    </visual>
  </link>
</robot>`;

function makeCustomLayer(
  instanceId: string,
  overrides: Partial<LayerSettingsCustomUrdf> = {},
): LayerSettingsCustomUrdf {
  return {
    layerId: "foxglove.Urdf",
    instanceId,
    label: instanceId,
    visible: true,
    frameLocked: true,
    sourceType: "url",
    url: "",
    filePath: "",
    parameter: "",
    topic: "",
    framePrefix: "",
    displayMode: "auto",
    ...overrides,
  };
}

function makeConfig(overrides: Partial<RendererConfig> = {}): RendererConfig {
  return {
    cameraState: DEFAULT_CAMERA_STATE,
    followMode: "follow-pose",
    followTf: undefined,
    scene: {},
    transforms: {},
    topics: {},
    layers: {},
    publish: DEFAULT_PUBLISH_SETTINGS,
    imageMode: {},
    ...overrides,
  };
}

function makeRenderer(config: RendererConfig): Renderer {
  const parent = document.createElement("div");
  const canvas = document.createElement("canvas");
  parent.appendChild(canvas);
  return new Renderer({
    canvas,
    config,
    interfaceMode: "3d",
    fetchAsset: async () => {
      throw new Error("Unexpected asset fetch");
    },
    sceneExtensionConfig: DEFAULT_SCENE_EXTENSION_CONFIG,
    testOptions: {},
    customCameraModels: new Map(),
  });
}

describe("Urdfs opacity", () => {
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
    setupJestCanvasMock();
    mockOrbitControls = {
      ...DEFAULT_ORBIT_CONTROLS_CONFIG,
      addEventListener: jest.fn(),
      listenToKeyEvents: jest.fn(),
      getDistance: jest.fn().mockReturnValue(DEFAULT_CAMERA_STATE.distance),
      getPolarAngle: jest.fn().mockReturnValue(0),
      getAzimuthalAngle: jest.fn().mockReturnValue(0),
      target: new THREE.Vector3(),
      update: jest.fn(),
      minPolarAngle: 0,
      maxPolarAngle: Math.PI,
    };
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("exposes an opacity control for custom URDF layers", () => {
    const layer: LayerSettingsCustomUrdf = {
      layerId: "foxglove.Urdf",
      instanceId: "ghost",
      label: "Ghost",
      visible: true,
      frameLocked: true,
      sourceType: "url",
      url: "",
      framePrefix: "",
      displayMode: "auto",
      opacity: 0.35,
    };
    const renderer = makeRenderer(makeConfig({ layers: { ghost: layer } }));
    const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;

    const settingsNode = urdfs.settingsNodes()[0];
    const opacityField = settingsNode?.node.fields?.opacity;

    expect(opacityField).toMatchObject({
      input: "number",
      min: 0,
      max: 1,
      step: 0.05,
      value: 0.35,
    });
    settingsNode?.node.handler?.({
      action: "update",
      payload: {
        path: ["layers", "ghost", "opacity"],
        input: "number",
        value: 0.6,
      },
    });
    expect((renderer.config.layers.ghost as LayerSettingsCustomUrdf | undefined)?.opacity).toBe(
      0.6,
    );
    renderer.dispose();
  });

  it("exposes opacity for topic and parameter URDFs", () => {
    const renderer = makeRenderer(
      makeConfig({
        topics: {
          "/robot_description": { visible: true, opacity: 0.4 } as Partial<LayerSettingsUrdf>,
          "param:/robot_description": {
            visible: true,
            opacity: 0.7,
          } as Partial<LayerSettingsUrdf>,
        },
      }),
    );
    renderer.setTopics([{ name: "/robot_description", schemaName: "std_msgs/String" }]);
    renderer.setParameters(new Map([["/robot_description", 123]]));
    const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;

    const nodes = urdfs.settingsNodes();

    expect(
      nodes.find((entry) => entry.path[1] === "/robot_description")?.node.fields?.opacity,
    ).toMatchObject({
      value: 0.4,
    });
    expect(
      nodes.find((entry) => entry.path[1] === "param:/robot_description")?.node.fields?.opacity,
    ).toMatchObject({ value: 0.7 });
    renderer.dispose();
  });

  it("defaults every URDF source opacity to fully opaque", () => {
    const layer: LayerSettingsCustomUrdf = {
      layerId: "foxglove.Urdf",
      instanceId: "default-opacity",
      label: "Default opacity",
      visible: true,
      frameLocked: true,
      sourceType: "url",
      url: "",
      framePrefix: "",
      displayMode: "auto",
    };
    const renderer = makeRenderer(
      makeConfig({
        topics: {
          "/robot_description": { visible: true },
          "param:/robot_description": { visible: true },
        },
        layers: { "default-opacity": layer },
      }),
    );
    renderer.setTopics([{ name: "/robot_description", schemaName: "std_msgs/String" }]);
    renderer.setParameters(new Map([["/robot_description", 123]]));
    const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;

    const opacityValues = urdfs.settingsNodes().map((entry) => entry.node.fields?.opacity?.value);

    expect(opacityValues).toEqual([1, 1, 1]);
    renderer.dispose();
  });

  it.each([
    { opacity: 0.25, expectedAlpha: 0.2 },
    { opacity: undefined, expectedAlpha: 0.8 },
  ])("applies layer opacity $opacity to URDF material alpha", async ({
    opacity,
    expectedAlpha,
  }) => {
    const topicSettings: Partial<LayerSettingsUrdf> = { visible: true, opacity };
    const renderer = makeRenderer(makeConfig({ topics: { "/robot_description": topicSettings } }));
    const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;
    const topicSubscription = urdfs.getSubscriptions()[0];
    if (topicSubscription?.type !== "topic") {
      throw new Error("Expected /robot_description topic subscription");
    }
    const messageEvent: MessageEvent<{ data: string }> = {
      topic: "/robot_description",
      schemaName: "std_msgs/String",
      receiveTime: { sec: 0, nsec: 0 },
      message: { data: URDF },
      sizeInBytes: URDF.length,
    };

    topicSubscription.subscription.handler(messageEvent);
    await waitFor(() => {
      const robot = urdfs.renderables.get("/robot_description");
      const child = robot?.userData.renderables.values().next().value;
      const markerAlpha = (child?.userData as MarkerUserData | undefined)?.marker.color.a;
      expect(markerAlpha).toBeCloseTo(expectedAlpha);
    });

    renderer.dispose();
  });

  it("updates opacity in place without rebuilding child renderables", async () => {
    const renderer = makeRenderer(
      makeConfig({
        topics: {
          "/robot_description": { visible: true, opacity: 1 } as Partial<LayerSettingsUrdf>,
        },
      }),
    );
    renderer.setTopics([{ name: "/robot_description", schemaName: "std_msgs/String" }]);
    const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;
    const topicSubscription = urdfs.getSubscriptions()[0];
    if (topicSubscription?.type !== "topic") {
      throw new Error("Expected /robot_description topic subscription");
    }
    const messageEvent: MessageEvent<{ data: string }> = {
      topic: "/robot_description",
      schemaName: "std_msgs/String",
      receiveTime: { sec: 0, nsec: 0 },
      message: { data: URDF },
      sizeInBytes: URDF.length,
    };

    topicSubscription.subscription.handler(messageEvent);
    let childBefore: unknown;
    await waitFor(() => {
      const robot = urdfs.renderables.get("/robot_description");
      childBefore = robot?.userData.renderables.values().next().value;
      expect(childBefore).toBeDefined();
    });

    const removeChildren = jest.spyOn(
      urdfs.renderables.get("/robot_description")!,
      "removeChildren",
    );

    const settingsNode = urdfs
      .settingsNodes()
      .find((entry) => entry.path[1] === "/robot_description");
    expect(settingsNode?.node.handler).toBeDefined();
    settingsNode?.node.handler?.({
      action: "update",
      payload: {
        path: ["topics", "/robot_description", "opacity"],
        input: "number",
        value: 0.25,
      },
    });

    const robot = urdfs.renderables.get("/robot_description");
    const childAfter = robot?.userData.renderables.values().next().value;
    expect(childAfter).toBe(childBefore);
    expect(removeChildren).not.toHaveBeenCalled();
    expect((childAfter?.userData as MarkerUserData).marker.color.a).toBeCloseTo(0.2);

    let outlineVisible = true;
    childAfter?.traverse((obj) => {
      if (obj instanceof THREE.LineSegments) {
        outlineVisible = obj.visible;
      }
    });
    expect(outlineVisible).toBe(false);

    renderer.dispose();
  });

  it("exposes topic, parameter, and file path fields for custom URDF sources", () => {
    const renderer = makeRenderer(
      makeConfig({
        layers: {
          "topic-layer": makeCustomLayer("topic-layer", {
            sourceType: "topic",
            topic: "/robot_description",
          }),
          "param-layer": makeCustomLayer("param-layer", {
            sourceType: "param",
            parameter: "/robot_description",
          }),
          "file-layer": makeCustomLayer("file-layer", {
            sourceType: "filePath",
            filePath: "/tmp/robot.urdf",
          }),
        },
      }),
    );
    renderer.setTopics([{ name: "/robot_description", schemaName: "std_msgs/String" }]);
    renderer.setParameters(new Map([["/robot_description", URDF]]));
    const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;

    const nodes = urdfs.settingsNodes();
    const topicFields = nodes.find((entry) => entry.path[1] === "topic-layer")?.node.fields;
    const paramFields = nodes.find((entry) => entry.path[1] === "param-layer")?.node.fields;
    const fileFields = nodes.find((entry) => entry.path[1] === "file-layer")?.node.fields;

    expect(topicFields?.topic).toMatchObject({
      value: "/robot_description",
      items: ["/robot_description"],
    });
    expect(paramFields?.parameter).toMatchObject({
      value: "/robot_description",
      items: ["/robot_description"],
    });
    expect(fileFields?.filePath).toMatchObject({
      value: "/tmp/robot.urdf",
    });

    renderer.dispose();
  });

  it("dispose cancels pending debounced URDF loads", () => {
    jest.useFakeTimers();
    const removeChildren = jest.spyOn(UrdfRenderable.prototype, "removeChildren");
    try {
      const layer = makeCustomLayer("debounce-test");
      const renderer = makeRenderer(makeConfig({ layers: { "debounce-test": layer } }));
      const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;
      const settingsNode = urdfs.settingsNodes().find((entry) => entry.path[1] === "debounce-test");
      expect(settingsNode).toBeDefined();
      expect(settingsNode?.node.handler).toBeDefined();

      settingsNode!.node.handler!({
        action: "update",
        payload: {
          path: ["layers", "debounce-test", "framePrefix"],
          input: "string",
          value: "hw_",
        },
      });

      urdfs.dispose();
      const callsAfterDispose = removeChildren.mock.calls.length;
      jest.advanceTimersByTime(1000);
      expect(removeChildren.mock.calls).toHaveLength(callsAfterDispose);

      renderer.dispose();
    } finally {
      removeChildren.mockRestore();
      jest.useRealTimers();
    }
  });

  it("deleting a custom URDF layer cancels pending debounced loads", () => {
    jest.useFakeTimers();
    const removeChildren = jest.spyOn(UrdfRenderable.prototype, "removeChildren");
    try {
      const layer = makeCustomLayer("delete-debounce");
      const renderer = makeRenderer(makeConfig({ layers: { "delete-debounce": layer } }));
      const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;
      const settingsNode = urdfs
        .settingsNodes()
        .find((entry) => entry.path[1] === "delete-debounce");
      expect(settingsNode).toBeDefined();
      expect(settingsNode?.node.handler).toBeDefined();

      settingsNode!.node.handler!({
        action: "update",
        payload: {
          path: ["layers", "delete-debounce", "framePrefix"],
          input: "string",
          value: "hw_",
        },
      });

      settingsNode!.node.handler!({
        action: "perform-node-action",
        payload: { id: "delete", path: ["layers", "delete-debounce"] },
      });

      expect(urdfs.renderables.has("delete-debounce")).toBe(false);
      const callsAfterDelete = removeChildren.mock.calls.length;
      jest.advanceTimersByTime(1000);
      expect(removeChildren.mock.calls).toHaveLength(callsAfterDelete);

      renderer.dispose();
    } finally {
      removeChildren.mockRestore();
      jest.useRealTimers();
    }
  });

  it("framePrefix changes still debounce a URDF reload", () => {
    jest.useFakeTimers();
    const removeChildren = jest.spyOn(UrdfRenderable.prototype, "removeChildren");
    try {
      const renderer = makeRenderer(
        makeConfig({
          topics: { "/robot_description": { visible: true } },
        }),
      );
      renderer.setTopics([{ name: "/robot_description", schemaName: "std_msgs/String" }]);
      const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;
      const settingsNode = urdfs
        .settingsNodes()
        .find((entry) => entry.path[1] === "/robot_description");
      expect(settingsNode).toBeDefined();
      expect(settingsNode?.node.handler).toBeDefined();

      const callsBefore = removeChildren.mock.calls.length;
      settingsNode!.node.handler!({
        action: "update",
        payload: {
          path: ["topics", "/robot_description", "framePrefix"],
          input: "string",
          value: "hw_",
        },
      });

      expect(removeChildren.mock.calls).toHaveLength(callsBefore);

      jest.advanceTimersByTime(500);
      expect(removeChildren.mock.calls).toHaveLength(callsBefore + 1);

      renderer.dispose();
    } finally {
      removeChildren.mockRestore();
      jest.useRealTimers();
    }
  });

  it("applies layer opacity to cylinder and sphere visuals", async () => {
    const renderer = makeRenderer(
      makeConfig({
        topics: {
          "/robot_description": { visible: true, opacity: 0.5 } as Partial<LayerSettingsUrdf>,
        },
      }),
    );
    renderer.setTopics([{ name: "/robot_description", schemaName: "std_msgs/String" }]);
    const urdfs = renderer.sceneExtensions.get(Urdfs.extensionId) as Urdfs;
    const topicSubscription = urdfs.getSubscriptions()[0];
    if (topicSubscription?.type !== "topic") {
      throw new Error("Expected /robot_description topic subscription");
    }

    topicSubscription.subscription.handler({
      topic: "/robot_description",
      schemaName: "std_msgs/String",
      receiveTime: { sec: 0, nsec: 0 },
      message: { data: SHAPES_URDF },
      sizeInBytes: SHAPES_URDF.length,
    });

    await waitFor(() => {
      const robot = urdfs.renderables.get("/robot_description");
      expect(robot?.userData.renderables.size).toBe(2);
    });

    const alphas = [
      ...(urdfs.renderables.get("/robot_description")?.userData.renderables.values() ?? []),
    ]
      .map((child) => (child.userData as MarkerUserData).marker.color.a)
      .sort((a, b) => a - b);

    expect(alphas).toEqual([0.4, 0.5]);
    renderer.dispose();
  });
});
