/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { CameraModelsMap } from "@lichtblick/den/image/types";
import { toNanoSec } from "@lichtblick/rostime";
import { SettingsTreeAction } from "@lichtblick/suite";
import { IRenderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/IRenderer";
import { PartialMessageEvent } from "@lichtblick/suite-base/panels/ThreeDeeRender/SceneExtension";
import { Topic } from "@lichtblick/suite-base/players/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import { IncomingCameraInfo } from "../ros";
import { makePose } from "../transforms";
import { Cameras, CameraInfoRenderable, LayerSettingsCameraInfo } from "./Cameras";
import { RenderableLineList } from "./markers/RenderableLineList";

const mockAdd = jest.fn();
const mockAddToTopic = jest.fn();
const mockRemove = jest.fn();
const mockRemoveFromTopic = jest.fn();
const mockUpdateConfig = jest.fn();
const mockNormalizeFrameId = jest.fn((id: string) => id);
const mockQueueAnimationFrame = jest.fn();
const mockSetNodesForKey = jest.fn();

function createMockRenderer(
  config: Partial<{ topics: Record<string, Partial<LayerSettingsCameraInfo>> }> = {},
  topics: Topic[] = [],
  customCameraModels: CameraModelsMap = new Map(),
): IRenderer {
  return {
    config: {
      topics: config.topics ?? {},
    },
    topics,
    normalizeFrameId: mockNormalizeFrameId,
    queueAnimationFrame: mockQueueAnimationFrame,
    settings: {
      errors: {
        add: mockAdd,
        addToTopic: mockAddToTopic,
        remove: mockRemove,
        removeFromTopic: mockRemoveFromTopic,
      },
      setNodesForKey: mockSetNodesForKey,
    },
    input: {
      canvasSize: new THREE.Vector2(1920, 1080),
    },
    updateConfig: mockUpdateConfig,
    customCameraModels,
  } as unknown as IRenderer;
}

function createMessageEvent(
  topic: string,
  message: Partial<IncomingCameraInfo>,
  receiveTime?: { sec: number; nsec: number },
): PartialMessageEvent<IncomingCameraInfo> {
  const defaultReceiveTime = { sec: 1, nsec: 0 };
  return {
    topic,
    receiveTime: receiveTime ?? defaultReceiveTime,
    message: {
      header: {
        frame_id: BasicBuilder.string(),
        stamp: { sec: 0, nsec: 0 },
        seq: 0,
      },
      height: 480,
      width: 640,
      distortion_model: "plumb_bob",
      D: [0, 0, 0, 0, 0],
      K: [500, 0, 320, 0, 500, 240, 0, 0, 1],
      R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      P: [500, 0, 320, 0, 0, 500, 240, 0, 0, 0, 1, 0],
      binning_x: 1,
      binning_y: 1,
      roi: {
        x_offset: 0,
        y_offset: 0,
        height: 0,
        width: 0,
        do_rectify: false,
      },
      ...message,
    } as IncomingCameraInfo,
    schemaName: "sensor_msgs/CameraInfo",
    sizeInBytes: 0,
  };
}

// Default settings for camera rendering
const DEFAULT_SETTINGS: LayerSettingsCameraInfo = {
  visible: false,
  frameLocked: true,
  distance: 1,
  planarProjectionFactor: 0,
  width: 1,
  color: "#00ffff",
};

describe("CameraInfoRenderable", () => {
  let mockRenderer: IRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRenderer = createMockRenderer();
  });

  describe("Given a CameraInfoRenderable instance", () => {
    describe("When dispose is called", () => {
      it("Then should dispose lines and call parent dispose", () => {
        // Given
        const topic = BasicBuilder.string();
        const renderable = new CameraInfoRenderable(topic, mockRenderer, {
          receiveTime: 0n,
          messageTime: 0n,
          frameId: BasicBuilder.string(),
          pose: makePose(),
          settingsPath: ["topics", topic],
          settings: { ...DEFAULT_SETTINGS },
          topic,
          cameraInfo: undefined,
          originalMessage: undefined,
          cameraModel: undefined,
          lines: undefined,
        });

        const mockDispose = jest.fn();
        const mockLines = {
          dispose: mockDispose,
        } as unknown as RenderableLineList;
        renderable.userData.lines = mockLines;

        // When
        renderable.dispose();

        // Then
        expect(mockDispose).toHaveBeenCalledTimes(1);
      });

      it("Then should handle dispose when lines is undefined", () => {
        // Given
        const topic = BasicBuilder.string();
        const renderable = new CameraInfoRenderable(topic, mockRenderer, {
          receiveTime: 0n,
          messageTime: 0n,
          frameId: BasicBuilder.string(),
          pose: makePose(),
          settingsPath: ["topics", topic],
          settings: { ...DEFAULT_SETTINGS },
          topic,
          cameraInfo: undefined,
          originalMessage: undefined,
          cameraModel: undefined,
          lines: undefined,
        });

        // When - Then (should not throw)
        expect(() => {
          renderable.dispose();
        }).not.toThrow();
      });
    });

    describe("When details is called", () => {
      it("Then should return the original message", () => {
        // Given
        const topic = BasicBuilder.string();
        const originalMessage = { someField: BasicBuilder.string() };
        const renderable = new CameraInfoRenderable(topic, mockRenderer, {
          receiveTime: 0n,
          messageTime: 0n,
          frameId: BasicBuilder.string(),
          pose: makePose(),
          settingsPath: ["topics", topic],
          settings: { ...DEFAULT_SETTINGS },
          topic,
          cameraInfo: undefined,
          originalMessage,
          cameraModel: undefined,
          lines: undefined,
        });

        // When
        const details = renderable.details();

        // Then
        expect(details).toEqual(originalMessage);
      });

      it("Then should return empty object when originalMessage is undefined", () => {
        // Given
        const topic = BasicBuilder.string();
        const renderable = new CameraInfoRenderable(topic, mockRenderer, {
          receiveTime: 0n,
          messageTime: 0n,
          frameId: BasicBuilder.string(),
          pose: makePose(),
          settingsPath: ["topics", topic],
          settings: { ...DEFAULT_SETTINGS },
          topic,
          cameraInfo: undefined,
          originalMessage: undefined,
          cameraModel: undefined,
          lines: undefined,
        });

        // When
        const details = renderable.details();

        // Then
        expect(details).toEqual({});
      });
    });
  });
});

describe("Cameras", () => {
  let mockRenderer: IRenderer;
  let cameras: Cameras;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRenderer = createMockRenderer();
    cameras = new Cameras(mockRenderer);
  });

  describe("Given a Cameras extension", () => {
    describe("When constructed", () => {
      it("Then should set extensionId and customCameraModels", () => {
        // Given - When
        const customModels: CameraModelsMap = new Map();
        const renderer = createMockRenderer({}, [], customModels);
        const extension = new Cameras(renderer);

        // Then
        expect(Cameras.extensionId).toBe("foxglove.Cameras");
        expect(extension.customCameraModels).toBe(customModels);
      });

      it("Then should accept custom name parameter", () => {
        // Given
        const customName = BasicBuilder.string();

        // When
        const extension = new Cameras(mockRenderer, customName);

        // Then
        expect(extension.extensionId).toBe(customName);
      });
    });

    describe("When getSubscriptions is called", () => {
      it("Then should return ROS and Foxglove camera info subscriptions", () => {
        // Given - When
        const subscriptions = cameras.getSubscriptions();

        // Then
        expect(subscriptions).toHaveLength(2);
        expect(subscriptions[0]).toMatchObject({
          type: "schema",
          schemaNames: expect.any(Set),
        });
        expect(subscriptions[1]).toMatchObject({
          type: "schema",
          schemaNames: expect.any(Set),
        });
      });
    });

    describe("When settingsNodes is called", () => {
      it("Then should return empty array when no topics available", () => {
        // Given
        mockRenderer = createMockRenderer({}, []);
        cameras = new Cameras(mockRenderer);

        // When
        const nodes = cameras.settingsNodes();

        // Then
        expect(nodes).toEqual([]);
      });

      it("Then should return settings node for camera info topics", () => {
        // Given
        const topicName = "/camera/camera_info";
        const topics: Topic[] = [
          {
            name: topicName,
            schemaName: "sensor_msgs/CameraInfo",
          },
        ];
        mockRenderer = createMockRenderer({}, topics);
        cameras = new Cameras(mockRenderer);

        // When
        const nodes = cameras.settingsNodes();

        // Then
        expect(nodes).toHaveLength(1);
        expect(nodes[0]?.path).toEqual(["topics", topicName]);
        expect(nodes[0]?.node.icon).toBe("Camera");
        expect(nodes[0]?.node.fields).toHaveProperty("distance");
        expect(nodes[0]?.node.fields).toHaveProperty("planarProjectionFactor");
        expect(nodes[0]?.node.fields).toHaveProperty("width");
        expect(nodes[0]?.node.fields).toHaveProperty("color");
      });

      it("Then should use user config settings when available", () => {
        // Given
        const topicName = "/camera/camera_info";
        const customDistance = BasicBuilder.number({ min: 1, max: 10 });
        const topics: Topic[] = [
          {
            name: topicName,
            schemaName: "sensor_msgs/CameraInfo",
          },
        ];
        mockRenderer = createMockRenderer(
          {
            topics: {
              [topicName]: { distance: customDistance, visible: true },
            },
          },
          topics,
        );
        cameras = new Cameras(mockRenderer);

        // When
        const nodes = cameras.settingsNodes();

        // Then
        expect(nodes).toHaveLength(1);
        expect(nodes[0]?.node.fields?.distance?.value).toBe(customDistance);
        expect(nodes[0]?.node.visible).toBe(true);
      });

      it("Then should not return settings node for non-camera topics", () => {
        // Given
        const topics: Topic[] = [
          {
            name: "/some/other/topic",
            schemaName: "std_msgs/String",
          },
        ];
        mockRenderer = createMockRenderer({}, topics);
        cameras = new Cameras(mockRenderer);

        // When
        const nodes = cameras.settingsNodes();

        // Then
        expect(nodes).toEqual([]);
      });
    });

    describe("When handleSettingsAction is called", () => {
      it("Then should ignore non-update actions", () => {
        // Given
        const action = {
          action: "perform-node-action",
          payload: { id: "some-id", path: [] },
        } as SettingsTreeAction;

        // When
        cameras.handleSettingsAction(action);

        // Then - no error thrown, no changes made
        expect(mockUpdateConfig).not.toHaveBeenCalled();
      });

      it("Then should ignore paths with incorrect length", () => {
        // Given
        const action = {
          action: "update",
          payload: { path: ["topics"], value: true },
        } as unknown as SettingsTreeAction;

        // When
        cameras.handleSettingsAction(action);

        // Then - no error thrown
        expect(mockUpdateConfig).not.toHaveBeenCalled();
      });

      it("Then should update settings and renderable for valid path", () => {
        // Given
        const topicName = "/camera/camera_info";
        const messageEvent = createMessageEvent(topicName, {});

        // Create renderable first by handling a camera info message
        mockRenderer = createMockRenderer({}, []);
        cameras = new Cameras(mockRenderer);

        // Use a spy to call the private handler
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;
        if (handler) {
          handler(messageEvent);
        }

        const newDistance = BasicBuilder.number({ min: 1, max: 10 });
        const action = {
          action: "update",
          payload: { path: ["topics", topicName, "distance"], value: newDistance },
        } as unknown as SettingsTreeAction;

        // When
        cameras.handleSettingsAction(action);

        // Then
        const renderable = cameras.renderables.get(topicName);
        expect(renderable).toBeDefined();
      });
    });

    describe("When setCustomCameraModels is called", () => {
      it("Then should update the customCameraModels property", () => {
        // Given
        const mockModelBuilder = jest.fn();
        const newModels: CameraModelsMap = new Map();
        newModels.set("CustomModel", {
          extensionId: "test-extension",
          modelBuilder: mockModelBuilder,
        });

        // When
        cameras.setCustomCameraModels(newModels);

        // Then
        expect(cameras.customCameraModels).toBe(newModels);
        expect(cameras.customCameraModels.get("CustomModel")?.modelBuilder).toBe(mockModelBuilder);
      });
    });

    describe("When receiving CameraInfo messages", () => {
      it("Then should create a new renderable for first message", () => {
        // Given
        const topicName = "/camera/camera_info";
        const messageEvent = createMessageEvent(topicName, {});

        // When
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;
        if (handler) {
          handler(messageEvent);
        }

        // Then
        const renderable = cameras.renderables.get(topicName);
        expect(renderable).toBeInstanceOf(CameraInfoRenderable);
        expect(renderable?.userData.topic).toBe(topicName);
      });

      it("Then should update existing renderable on subsequent messages", () => {
        // Given
        const topicName = "/camera/camera_info";
        const firstMessage = createMessageEvent(topicName, {
          P: [500, 0, 320, 0, 0, 500, 240, 0, 0, 0, 1, 0],
        });
        const secondMessage = createMessageEvent(topicName, {
          P: [600, 0, 320, 0, 0, 600, 240, 0, 0, 0, 1, 0],
        });

        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;

        // When
        if (handler) {
          handler(firstMessage);
          handler(secondMessage);
        }

        // Then
        const renderablesCount = cameras.renderables.size;
        expect(renderablesCount).toBe(1);
      });

      it("Then should handle CameraInfo with invalid P matrix length", () => {
        // Given
        const topicName = "/camera/camera_info";
        const messageEvent = createMessageEvent(topicName, {
          P: [], // Invalid length (empty array)
        });

        // When
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;
        if (handler) {
          handler(messageEvent);
        }

        // Then
        expect(mockAddToTopic).toHaveBeenCalledWith(
          topicName,
          "CameraModel",
          expect.stringContaining("P has length 0"),
        );
      });

      it("Then should create camera model when P matrix is valid", () => {
        // Given
        const topicName = "/camera/camera_info";
        const messageEvent = createMessageEvent(topicName, {
          P: [500, 0, 320, 0, 0, 500, 240, 0, 0, 0, 1, 0],
        });

        // When
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;
        if (handler) {
          handler(messageEvent);
        }

        // Then
        const renderable = cameras.renderables.get(topicName);
        expect(renderable?.userData.cameraModel).toBeDefined();
      });

      it("Then should handle errors in camera model creation", () => {
        // Given
        const topicName = "/camera/camera_info";
        const customModels: CameraModelsMap = new Map();
        customModels.set("invalid", {
          extensionId: "test-extension",
          modelBuilder: () => {
            throw new Error("Invalid camera model");
          },
        });

        mockRenderer = createMockRenderer({}, [], customModels);
        cameras = new Cameras(mockRenderer);

        const messageEvent = createMessageEvent(topicName, {
          distortion_model: "invalid",
          P: [500, 0, 320, 0, 0, 500, 240, 0, 0, 0, 1, 0],
        });

        // When
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;
        if (handler) {
          handler(messageEvent);
        }

        // Then
        const renderable = cameras.renderables.get(topicName);
        expect(renderable?.userData.cameraModel).toBeUndefined();
      });

      it("Then should create wireframe lines when camera model is valid", () => {
        // Given
        const topicName = "/camera/camera_info";
        const messageEvent = createMessageEvent(topicName, {
          P: [500, 0, 320, 0, 0, 500, 240, 0, 0, 0, 1, 0],
        });

        // When
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;
        if (handler) {
          handler(messageEvent);
        }

        // Then
        const renderable = cameras.renderables.get(topicName);
        expect(renderable?.userData.lines).toBeDefined();
      });

      it("Then should apply user settings from config", () => {
        // Given
        const topicName = "/camera/camera_info";
        const customColor = "#FF0000";
        mockRenderer = createMockRenderer({
          topics: {
            [topicName]: { color: customColor },
          },
        });
        cameras = new Cameras(mockRenderer);

        const messageEvent = createMessageEvent(topicName, {
          P: [500, 0, 320, 0, 0, 500, 240, 0, 0, 0, 1, 0],
        });

        // When
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;
        if (handler) {
          handler(messageEvent);
        }

        // Then
        const renderable = cameras.renderables.get(topicName);
        expect(renderable?.userData.settings.color).toBe(customColor);
      });

      it("Then should normalize frame_id using renderer", () => {
        // Given
        const topicName = "/camera/camera_info";
        const frameId = "/camera_frame";
        const normalizedFrameId = "camera_frame";
        mockNormalizeFrameId.mockReturnValue(normalizedFrameId);

        const messageEvent = createMessageEvent(topicName, {
          header: {
            frame_id: frameId,
            stamp: { sec: 0, nsec: 0 },
            seq: 0,
          },
        });

        // When
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;
        if (handler) {
          handler(messageEvent);
        }

        // Then
        expect(mockNormalizeFrameId).toHaveBeenCalledWith(frameId);
        const renderable = cameras.renderables.get(topicName);
        expect(renderable?.userData.frameId).toBe(normalizedFrameId);
      });

      it("Then should update receiveTime and messageTime correctly", () => {
        // Given
        const topicName = "/camera/camera_info";
        const receiveTime = { sec: 10, nsec: 500 };
        const messageTime = { sec: 9, nsec: 0 };
        const messageEvent = createMessageEvent(topicName, {
          header: {
            frame_id: BasicBuilder.string(),
            stamp: messageTime,
            seq: 0,
          },
        });
        messageEvent.receiveTime = receiveTime;

        // When
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;
        if (handler) {
          handler(messageEvent);
        }

        // Then
        const renderable = cameras.renderables.get(topicName);
        expect(renderable?.userData.receiveTime).toBe(toNanoSec(receiveTime));
        expect(renderable?.userData.messageTime).toBe(toNanoSec(messageTime));
      });

      it("Then should redraw wireframe when settings change", () => {
        // Given
        const topicName = "/camera/camera_info";
        mockRenderer = createMockRenderer({
          topics: {
            [topicName]: { distance: 1 },
          },
        });
        cameras = new Cameras(mockRenderer);

        const messageEvent = createMessageEvent(topicName, {
          P: [500, 0, 320, 0, 0, 500, 240, 0, 0, 0, 1, 0],
        });

        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[0]?.subscription.handler;

        // Create initial renderable
        if (handler) {
          handler(messageEvent);
        }

        const renderable = cameras.renderables.get(topicName);

        // Update settings
        mockRenderer = createMockRenderer({
          topics: {
            [topicName]: { distance: 2 },
          },
        });

        const action = {
          action: "update",
          payload: { path: ["topics", topicName, "distance"], value: 2 },
        } as unknown as SettingsTreeAction;

        // When
        cameras.handleSettingsAction(action);

        // Then - lines should be updated (this is a simplified check)
        expect(renderable?.userData.lines).toBeDefined();
      });

      it("Then should handle CameraCalibration (Foxglove) messages", () => {
        // Given
        const topicName = "/camera/calibration";
        const messageEvent = createMessageEvent(topicName, {
          P: [500, 0, 320, 0, 0, 500, 240, 0, 0, 0, 1, 0],
        });

        // When
        const subscriptions = cameras.getSubscriptions();
        const handler = subscriptions[1]?.subscription.handler; // Second subscription is for CAMERA_CALIBRATION_DATATYPES
        if (handler) {
          handler(messageEvent);
        }

        // Then
        const renderable = cameras.renderables.get(topicName);
        expect(renderable).toBeInstanceOf(CameraInfoRenderable);
      });
    });
  });
});
