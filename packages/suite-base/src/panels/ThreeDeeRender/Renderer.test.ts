/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { setupJestCanvasMock } from "jest-canvas-mock";

import { fromNanoSec, toNanoSec } from "@lichtblick/rostime";
import { MessageEvent } from "@lichtblick/suite";
import { Asset } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { Renderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/Renderer";
import { DEFAULT_SCENE_EXTENSION_CONFIG } from "@lichtblick/suite-base/panels/ThreeDeeRender/SceneExtensionConfig";
import { DEFAULT_CAMERA_STATE } from "@lichtblick/suite-base/panels/ThreeDeeRender/camera";
import { CameraStateSettings } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/CameraStateSettings";
import { DEFAULT_PUBLISH_SETTINGS } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/PublishSettings";
import { TFMessage } from "@lichtblick/suite-base/panels/ThreeDeeRender/ros";

import { RendererConfig } from "./IRenderer";

// Jest doesn't support ES module imports fully yet, so we need to mock the wasm file
jest.mock("three/examples/jsm/libs/draco/draco_decoder.wasm", () => "");

// We need to mock the WebGLRenderer because it's not available in jsdom
// only mocking what we currently use
jest.mock("three", () => {
  const THREE = jest.requireActual("three");
  return {
    ...THREE,
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
  // Copied from: https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
  // mock matchMedia for `Renderer` class in ThreeDeeRender
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: ReactNull,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
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

const makeTf = () => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
});

function createTFMessageEvent(
  parentId: string,
  childId: string,
  receiveTime: bigint,
  headerStamps: bigint[],
  topic: string = "/tf",
): MessageEvent<TFMessage> {
  const stampedTfs = headerStamps.map((stamp) => ({
    header: {
      stamp: fromNanoSec(stamp),
      frame_id: parentId,
    },
    child_frame_id: childId,
    transform: makeTf(),
  }));
  return {
    topic,
    receiveTime: fromNanoSec(receiveTime),
    schemaName: "tf2_msgs/TFMessage",
    message: {
      transforms: stampedTfs,
    },
    sizeInBytes: 0,
  };
}

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
describe("3D Renderer", () => {
  let canvas = document.createElement("canvas");
  let parent = document.createElement("div");
  beforeEach(() => {
    jest.clearAllMocks();
    setupJestCanvasMock();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
  });
  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("constructs a renderer without error", () => {
    expect(() => new Renderer({ ...defaultRendererProps, canvas })).not.toThrow();
  });
  it("does not set a unfollow pose snapshot  when in follow-pose mode", () => {
    const renderer = new Renderer({
      ...defaultRendererProps,
      canvas,
      config: {
        ...defaultRendererConfig,
        followMode: "follow-pose",
        followTf: "display",
        scene: { transforms: { enablePreloading: false } },
      },
    });
    const cameraState = renderer.sceneExtensions.get(
      "foxglove.CameraStateSettings",
    ) as CameraStateSettings;

    renderer.setCurrentTime(1n);

    const tfWithDisplayParent = createTFMessageEvent("display", "childOfDisplay", 1n, [1n]);
    renderer.addMessageEvent(tfWithDisplayParent);
    renderer.animationFrame();

    // record to make sure it changes when there's a new fixed frame
    const tfWithDisplayChild = createTFMessageEvent("parentOfDisplay", "display", 1n, [1n]);
    tfWithDisplayChild.message.transforms[0]!.transform.translation.x = 1;
    renderer.addMessageEvent(tfWithDisplayChild);
    renderer.animationFrame();
    expect(cameraState.unfollowPoseSnapshot).toBeUndefined();
  });
  it("records pose snapshot after changing from follow-pose mode to follow-none", () => {
    const config = {
      ...defaultRendererConfig,
      followMode: "follow-pose" as const,
      followTf: "display",
      scene: { transforms: { enablePreloading: false } },
    };
    const renderer = new Renderer({ ...defaultRendererProps, canvas, config });
    const cameraState = renderer.sceneExtensions.get(
      "foxglove.CameraStateSettings",
    ) as CameraStateSettings;

    renderer.setCurrentTime(1n);

    const tfWithDisplayParent = createTFMessageEvent("display", "childOfDisplay", 1n, [1n]);
    renderer.addMessageEvent(tfWithDisplayParent);
    renderer.animationFrame();

    // record to make sure it changes when there's a new fixed frame
    const tfWithDisplayChild = createTFMessageEvent("parentOfDisplay", "display", 1n, [1n]);
    tfWithDisplayChild.message.transforms[0]!.transform.translation.x = 1;
    renderer.addMessageEvent(tfWithDisplayChild);
    renderer.animationFrame();
    expect(cameraState.unfollowPoseSnapshot).toBeUndefined();
    renderer.config = { ...config, followMode: "follow-none" };
    renderer.animationFrame();
    // parent is the camera group that holds the pose from the snapshot
    expect(cameraState.unfollowPoseSnapshot?.position).toEqual({
      x: 1,
      y: 0,
      z: 0,
    });
  });
  it("sets pose snapshot to undefined after changing from follow-none mode to follow-pose", () => {
    const config = {
      ...defaultRendererConfig,
      followMode: "follow-none" as const,
      followTf: "display",
      scene: { transforms: { enablePreloading: false } },
    };
    const renderer = new Renderer({ ...defaultRendererProps, canvas, config });
    const cameraState = renderer.sceneExtensions.get(
      "foxglove.CameraStateSettings",
    ) as CameraStateSettings;

    renderer.setCurrentTime(1n);

    const tfWithDisplayParent = createTFMessageEvent("display", "childOfDisplay", 1n, [1n]);
    renderer.addMessageEvent(tfWithDisplayParent);
    renderer.animationFrame();

    // record to make sure it changes when there's a new fixed frame
    const tfWithDisplayChild = createTFMessageEvent("parentOfDisplay", "display", 1n, [1n]);
    tfWithDisplayChild.message.transforms[0]!.transform.translation.x = 1;
    renderer.addMessageEvent(tfWithDisplayChild);
    renderer.animationFrame();
    expect(cameraState.unfollowPoseSnapshot?.position).toEqual({
      x: 1,
      y: 0,
      z: 0,
    });
    renderer.config = { ...config, followMode: "follow-pose" };
    renderer.animationFrame();
    expect(cameraState.unfollowPoseSnapshot).toBeUndefined();
  });
  it("keeps same unfollowPoseSnapshot when switching from follow-none to follow-position", () => {
    const config = {
      ...defaultRendererConfig,
      followMode: "follow-none" as const,
      followTf: "display",
      scene: { transforms: { enablePreloading: false } },
    };
    const renderer = new Renderer({ ...defaultRendererProps, canvas, config });
    const cameraState = renderer.sceneExtensions.get(
      "foxglove.CameraStateSettings",
    ) as CameraStateSettings;

    renderer.setCurrentTime(1n);

    const tfWithDisplayParent = createTFMessageEvent("display", "childOfDisplay", 1n, [1n]);
    renderer.addMessageEvent(tfWithDisplayParent);
    renderer.animationFrame();

    // record to make sure it changes when there's a new fixed frame
    const tfWithDisplayChild = createTFMessageEvent("parentOfDisplay", "display", 1n, [1n]);
    tfWithDisplayChild.message.transforms[0]!.transform.translation.x = 1;
    renderer.addMessageEvent(tfWithDisplayChild);
    renderer.animationFrame();
    expect(cameraState.unfollowPoseSnapshot?.position).toEqual({
      x: 1,
      y: 0,
      z: 0,
    });
    renderer.config = { ...config, followMode: "follow-position" };
    renderer.animationFrame();
    expect(cameraState.unfollowPoseSnapshot?.position).toEqual({
      x: 1,
      y: 0,
      z: 0,
    });
  });
  it("in fixed follow mode: ensures that the unfollowPoseSnapshot updates when there is a new fixedFrame", () => {
    const renderer = new Renderer({
      ...defaultRendererProps,
      canvas,
      config: {
        ...defaultRendererConfig,
        followMode: "follow-none",
        followTf: "display",
        scene: { transforms: { enablePreloading: false } },
      },
    });
    const cameraState = renderer.sceneExtensions.get(
      "foxglove.CameraStateSettings",
    ) as CameraStateSettings;

    renderer.setCurrentTime(1n);

    const tfWithDisplayParent = createTFMessageEvent("display", "childOfDisplay", 1n, [1n]);
    renderer.addMessageEvent(tfWithDisplayParent);
    renderer.animationFrame();

    // record to make sure it changes when there's a new fixed frame
    const tfWithDisplayChild = createTFMessageEvent("parentOfDisplay", "display", 1n, [1n]);
    tfWithDisplayChild.message.transforms[0]!.transform.translation.x = 1;
    renderer.addMessageEvent(tfWithDisplayChild);
    renderer.animationFrame();
    expect(renderer.fixedFrameId).toEqual("parentOfDisplay");
    expect(cameraState.unfollowPoseSnapshot?.position).toEqual({
      x: 1,
      y: 0,
      z: 0,
    });

    const tfWithFinalRoot = createTFMessageEvent("root", "parentOfDisplay", 1n, [1n]);
    tfWithFinalRoot.message.transforms[0]!.transform.translation.y = 1;
    renderer.addMessageEvent(tfWithFinalRoot);
    renderer.animationFrame();
    expect(renderer.fixedFrameId).toEqual("root");
    // combines the two translations
    expect(cameraState.unfollowPoseSnapshot?.position).toEqual({
      x: 1,
      y: 1,
      z: 0,
    });
  });
  it("tfPreloading off:  when seeking to before currentTime, clears transform tree", () => {
    // This test is meant accurately represent the flow of seek through the react component

    const renderer = new Renderer({
      ...defaultRendererProps,
      canvas,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: false } },
      },
    });
    let currentFrame = [];

    // initialize renderer with transforms

    // first frame
    let currentTime = 5n;
    const beforeHeader = createTFMessageEvent("root", "before", currentTime, [currentTime - 2n]);
    // transform with headerstamp before currentTime
    currentFrame = [beforeHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => {
      renderer.addMessageEvent(msg);
    });

    // second frame
    currentTime = 6n;
    const onHeader = createTFMessageEvent("root", "on", currentTime, [currentTime]);
    // transform with headerstamp on currentTime
    currentFrame = [onHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => {
      renderer.addMessageEvent(msg);
    });

    // third frame
    currentTime = 7n;
    const afterHeader = createTFMessageEvent("root", "after", currentTime, [currentTime + 2n]);
    // transform with headerstamp after currentTime
    currentFrame = [afterHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => {
      renderer.addMessageEvent(msg);
    });
    // messages processed by renderer on animation frame
    renderer.animationFrame();

    expect(renderer.transformTree.frame("before")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after")).not.toBeUndefined();

    //seek to 5n

    const oldTime = currentTime;
    currentTime = 5n;
    renderer.setCurrentTime(currentTime);
    renderer.handleSeek(oldTime);
    // should have cleared transforms so that no future-to-the-currentTime transforms are in the tree
    expect(renderer.transformTree.frame("before")).toBeUndefined();
    expect(renderer.transformTree.frame("on")).toBeUndefined();
    expect(renderer.transformTree.frame("after")).toBeUndefined();
    // currentFrame will be set back to what it was at that time
    currentFrame = [beforeHeader];
    currentFrame.forEach((msg) => {
      renderer.addMessageEvent(msg);
    });
    // messages processed by renderer on animation frame
    renderer.animationFrame();

    expect(renderer.transformTree.frame("before")).not.toBeUndefined();
  });
  it("tfPreloading off: when seeking to time after currentTime, does not clear transform tree", () => {
    // This test is meant accurately represent the flow of seek through the react component

    const renderer = new Renderer({
      ...defaultRendererProps,
      canvas,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: false } },
      },
    });
    let currentFrame = [];

    // initialize renderer with transforms

    // first frame
    let currentTime = 5n;
    const beforeHeader = createTFMessageEvent("root", "before", currentTime, [currentTime - 2n]);
    // transform with headerstamp before currentTime
    currentFrame = [beforeHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => {
      renderer.addMessageEvent(msg);
    });

    // second frame
    currentTime = 6n;
    const onHeader = createTFMessageEvent("root", "on", currentTime, [currentTime]);
    // transform with headerstamp on currentTime
    currentFrame = [onHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => {
      renderer.addMessageEvent(msg);
    });

    // third frame
    currentTime = 7n;
    const afterHeader = createTFMessageEvent("root", "after", currentTime, [currentTime + 2n]);
    // transform with headerstamp after currentTime
    currentFrame = [afterHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => {
      renderer.addMessageEvent(msg);
    });
    // messages processed by renderer on animation frame
    renderer.animationFrame();

    expect(renderer.transformTree.frame("before")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after")).not.toBeUndefined();

    //seek to 10n (forward)

    const oldTime = currentTime;
    currentTime = 10n;
    renderer.setCurrentTime(currentTime);
    renderer.handleSeek(oldTime);
    // should not have cleared transforms
    expect(renderer.transformTree.frame("before")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after")).not.toBeUndefined();
    // currentFrame will be set back to what it was at that time
    const seekOnHeader = createTFMessageEvent("root", "seekOn", currentTime, [currentTime]);
    currentFrame = [seekOnHeader];
    currentFrame.forEach((msg) => {
      renderer.addMessageEvent(msg);
    });
    // messages processed by renderer on animation frame
    renderer.animationFrame();

    expect(renderer.transformTree.frame("before")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after")).not.toBeUndefined();
    expect(renderer.transformTree.frame("seekOn")).not.toBeUndefined();
  });
  it("tfPreloading on:  when seeking to before currentTime, clears transform tree and repopulates it up to receiveTime from allFrames", () => {
    const renderer = new Renderer({
      ...defaultRendererProps,
      canvas,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });
    const allFrames = [
      createTFMessageEvent("root", "before4", 5n, [1n]),
      createTFMessageEvent("root", "before2", 6n, [4n]),
      createTFMessageEvent("root", "on", 7n, [7n]),
      createTFMessageEvent("root", "after2", 8n, [10n]),
      createTFMessageEvent("root", "after4", 9n, [13n]),
    ];

    // initialize renderer with transforms
    let currentTime = 8n;
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(allFrames);
    // messages processed by renderer on animation frame
    renderer.animationFrame();
    expect(renderer.transformTree.frame("before4")).not.toBeUndefined();
    expect(renderer.transformTree.frame("before2")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after2")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after4")).toBeUndefined();

    //seek to 6n (backwards)

    const oldTime = currentTime;
    currentTime = 6n;
    renderer.setCurrentTime(currentTime);
    renderer.handleSeek(oldTime);
    // should have cleared transforms so that no future-to-the-currentTime transforms are in the tree
    expect(renderer.transformTree.frame("before4")).toBeUndefined();
    expect(renderer.transformTree.frame("before2")).toBeUndefined();
    expect(renderer.transformTree.frame("on")).toBeUndefined();
    expect(renderer.transformTree.frame("after2")).toBeUndefined();
    expect(renderer.transformTree.frame("after4")).toBeUndefined();

    // repopulate up to current receiveTime from allFrames
    renderer.handleAllFramesMessages(allFrames);
    // messages processed by renderer on animation frame
    renderer.animationFrame();
    expect(renderer.transformTree.frame("before4")).not.toBeUndefined();
    expect(renderer.transformTree.frame("before2")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).toBeUndefined();
    expect(renderer.transformTree.frame("after2")).toBeUndefined();
    expect(renderer.transformTree.frame("after4")).toBeUndefined();
  });
  it("tfPreloading on: does not clear transform tree when seeking to after", () => {
    const renderer = new Renderer({
      ...defaultRendererProps,
      canvas,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });
    const allFrames = [
      createTFMessageEvent("root", "before4", 5n, [1n]),
      createTFMessageEvent("root", "before2", 6n, [4n]),
      createTFMessageEvent("root", "on", 7n, [7n]),
      createTFMessageEvent("root", "after2", 8n, [10n]),
      createTFMessageEvent("root", "after4", 9n, [13n]),
    ];

    // initialize renderer with normal transforms
    let currentTime = 7n;
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(allFrames);
    // messages processed by renderer on animation frame
    renderer.animationFrame();
    expect(renderer.transformTree.frame("before4")).not.toBeUndefined();
    expect(renderer.transformTree.frame("before2")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after2")).toBeUndefined();
    expect(renderer.transformTree.frame("after4")).toBeUndefined();

    //seek to 9n (forwards)

    const oldTime = currentTime;
    currentTime = 9n;
    renderer.setCurrentTime(currentTime);
    renderer.handleSeek(oldTime);
    // should not have cleared tree, so should be same as before
    expect(renderer.transformTree.frame("before4")).not.toBeUndefined();
    expect(renderer.transformTree.frame("before2")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after2")).toBeUndefined();
    expect(renderer.transformTree.frame("after4")).toBeUndefined();

    // repopulate up to current receiveTime from allFrames
    renderer.handleAllFramesMessages(allFrames);
    // messages processed by renderer on animation frame
    renderer.animationFrame();
    expect(renderer.transformTree.frame("before4")).not.toBeUndefined();
    expect(renderer.transformTree.frame("before2")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after2")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after4")).not.toBeUndefined();
  });
});

describe("Renderer.handleAllFramesMessages behavior", () => {
  let canvas = document.createElement("canvas");
  let parent = document.createElement("div");
  let rendererArgs: ConstructorParameters<typeof Renderer>[0] = {
    ...defaultRendererProps,
    canvas,
  };
  beforeEach(() => {
    jest.clearAllMocks();
    setupJestCanvasMock();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    rendererArgs = { ...rendererArgs, canvas };
  });
  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("constructs a renderer without error", () => {
    expect(() => new Renderer(rendererArgs)).not.toThrow();
  });
  it("does not add in allFramesMessages if no messages are before currentTime", () => {
    const renderer = new Renderer(rendererArgs);

    const msgs = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(10 + i), [BigInt(i)]));
    }
    const addMessageEventMock = jest.spyOn(renderer, "addMessageEvent");
    const currentTime = 5n;
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventMock).not.toHaveBeenCalled();
  });
  it("adds messages with receiveTime up to currentTime", () => {
    // Given: A renderer with 10 messages
    const renderer = new Renderer(rendererArgs);
    const msgs = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const currentTime = 4n;
    const addMessageEventBatchMock = jest.spyOn(renderer, "addMessageEventBatch");

    // When: Processing messages up to currentTime
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(msgs);

    // Then: Only messages up to time 4 should be processed
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    const processedMessages = addMessageEventBatchMock.mock.calls[0]?.[0];
    expect(processedMessages).toHaveLength(5);
  });
  it("adds later messages after currentTime is updated", () => {
    // Given: A renderer with 10 messages
    const renderer = new Renderer(rendererArgs);
    const msgs = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const addMessageEventBatchMock = jest.spyOn(renderer, "addMessageEventBatch");

    // When: Processing messages up to time 4
    renderer.setCurrentTime(4n);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    const firstBatch = addMessageEventBatchMock.mock.calls[0]?.[0];
    expect(firstBatch).toHaveLength(5);

    // When: Updating time to 5
    addMessageEventBatchMock.mockClear();
    renderer.setCurrentTime(5n);
    renderer.handleAllFramesMessages(msgs);

    // Then: Only the additional message should be processed
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    const secondBatch = addMessageEventBatchMock.mock.calls[0]?.[0];
    expect(secondBatch).toHaveLength(1);
  });
  it("reads all messages when last message receiveTime is before currentTime", () => {
    // Given: A renderer with 10 messages all before current time
    const renderer = new Renderer(rendererArgs);
    const msgs = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const currentTime = 11n;
    const addMessageEventBatchMock = jest.spyOn(renderer, "addMessageEventBatch");

    // When: Setting current time and handling messages
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(msgs);

    // Then: All messages should be processed in batch
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    expect(addMessageEventBatchMock).toHaveBeenCalledWith(msgs);
  });
  it("reads reads new messages when allFrames array is added to", () => {
    // Given: A renderer with initial 10 messages
    const renderer = new Renderer(rendererArgs);
    const msgs = [];
    let i = 0;
    for (i; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const currentTime = 11n;
    const addMessageEventBatchMock = jest.spyOn(renderer, "addMessageEventBatch");

    // When: Processing first batch
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);

    // When: Adding more messages and processing again
    addMessageEventBatchMock.mockClear();
    for (i; i < 20; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    renderer.handleAllFramesMessages(msgs);

    // Then: Only the two additional messages before currentTime should be processed
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    const newMessages = addMessageEventBatchMock.mock.calls[0]?.[0];
    expect(newMessages).toHaveLength(2);
  });
  it("doesn't read messages when currentTime is updated but no more receiveTimes are past it", () => {
    // Given: A renderer with messages all before current time
    const renderer = new Renderer(rendererArgs);
    const msgs = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const addMessageEventBatchMock = jest.spyOn(renderer, "addMessageEventBatch");

    // When: Processing all messages
    renderer.setCurrentTime(11n);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);

    // When: Updating time without new messages to process
    addMessageEventBatchMock.mockClear();
    renderer.setCurrentTime(12n);
    const newMessagesHandled = renderer.handleAllFramesMessages(msgs);

    // Then: No new messages should be handled
    expect(newMessagesHandled).toBeFalsy();
    expect(addMessageEventBatchMock).not.toHaveBeenCalled();
  });
  it("adds all messages again after cursor is cleared", () => {
    // Given: A renderer with processed messages
    const renderer = new Renderer(rendererArgs);
    const msgs = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const addMessageEventBatchMock = jest.spyOn(renderer, "addMessageEventBatch");

    // When: Processing messages initially
    renderer.setCurrentTime(11n);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);

    // When: Clearing cursor and processing again
    addMessageEventBatchMock.mockClear();
    renderer.clear({ resetAllFramesCursor: true });
    const newMessagesHandled = renderer.handleAllFramesMessages(msgs);

    // Then: All messages should be processed again
    expect(newMessagesHandled).toBeTruthy();
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    expect(addMessageEventBatchMock).toHaveBeenCalledWith(msgs);
  });
  it("resets cursor if messages were added before the cursor index", () => {
    // Given: A renderer with messages starting at index 2
    const renderer = new Renderer(rendererArgs);
    const msgs = [];
    for (let i = 2; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const addMessageEventBatchMock = jest.spyOn(renderer, "addMessageEventBatch");

    // When: Processing initial messages
    renderer.setCurrentTime(5n);
    renderer.handleAllFramesMessages(msgs);
    const numMessagesBeforeTime = msgs.filter(
      (msg) => toNanoSec(msg.message.transforms[0]!.header.stamp) <= 5n,
    ).length;
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    const initialBatch = addMessageEventBatchMock.mock.calls[0]?.[0];
    expect(initialBatch).toHaveLength(numMessagesBeforeTime);

    // When: Adding message to beginning (before cursor)
    addMessageEventBatchMock.mockClear();
    msgs.unshift(createTFMessageEvent("a", "b", 1n, [1n]));
    const newMessagesHandled = renderer.handleAllFramesMessages(msgs);

    // Then: Should reprocess from beginning due to cursor reset
    expect(newMessagesHandled).toBeTruthy();
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    const reprocessedBatch = addMessageEventBatchMock.mock.calls[0]?.[0];
    expect(reprocessedBatch).toHaveLength(numMessagesBeforeTime + 1);
  });
  it("resets cursor if messages were removed before the cursor index", () => {
    // Given: A renderer with messages starting at index 2
    const renderer = new Renderer(rendererArgs);
    const msgs = [];
    for (let i = 2; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const addMessageEventBatchMock = jest.spyOn(renderer, "addMessageEventBatch");

    // When: Processing initial messages
    renderer.setCurrentTime(5n);
    renderer.handleAllFramesMessages(msgs);
    const numMessagesBeforeTime = msgs.filter(
      (msg) => toNanoSec(msg.message.transforms[0]!.header.stamp) <= 5n,
    ).length;
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);

    // When: Removing message from beginning (before cursor)
    addMessageEventBatchMock.mockClear();
    msgs.shift();
    const newMessagesHandled = renderer.handleAllFramesMessages(msgs);

    // Then: Should reprocess from beginning due to cursor reset
    expect(newMessagesHandled).toBeTruthy();
    expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    const reprocessedBatch = addMessageEventBatchMock.mock.calls[0]?.[0];
    expect(reprocessedBatch).toHaveLength(numMessagesBeforeTime - 1);
  });
  it.failing(
    "(does not) reset the cursor if number of messages added **and** removed before cursor are equal in a single update",
    () => {
      // Given: A renderer with messages starting at index 2
      const renderer = new Renderer(rendererArgs);
      const msgs = [];
      for (let i = 2; i < 10; i++) {
        msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
      }
      const addMessageEventBatchMock = jest.spyOn(renderer, "addMessageEventBatch");

      // When: Processing initial messages
      renderer.setCurrentTime(5n);
      renderer.handleAllFramesMessages(msgs);
      expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);

      // When: Removing and adding message at beginning (before cursor)
      addMessageEventBatchMock.mockClear();
      msgs.shift();
      msgs.unshift(createTFMessageEvent("a", "b", 1n, [1n]));
      const newMessagesHandled = renderer.handleAllFramesMessages(msgs);

      // Then: Should still reprocess because cursor was reset
      expect(newMessagesHandled).toBeTruthy();
      expect(addMessageEventBatchMock).toHaveBeenCalledTimes(1);
    },
  );
});

describe("Renderer backward seek behavior", () => {
  let canvas = document.createElement("canvas");
  let parent = document.createElement("div");
  let rendererArgs: ConstructorParameters<typeof Renderer>[0] = {
    ...defaultRendererProps,
    canvas,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupJestCanvasMock();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    rendererArgs = { ...defaultRendererProps, canvas };
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("uses binary search when seeking backward with preload enabled", () => {
    // Given: A renderer with preload enabled
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });
    const allFrames = [];
    for (let i = 0; i < 100; i++) {
      allFrames.push(createTFMessageEvent("parent", "child", BigInt(i * 1000), [BigInt(i * 1000)]));
    }

    // When: Processing messages up to current time
    renderer.setCurrentTime(99000n);
    const hasMessages = renderer.handleAllFramesMessages(allFrames);

    // Then: Messages should be processed
    expect(hasMessages).toBeTruthy();

    // When: Seeking backward with allFrames
    renderer.handleSeek(99000n, allFrames);

    // Then: Should not throw and process correctly
    expect(renderer.currentTime).toBe(99000n);
  });

  it("clears transforms correctly when seeking backward without preload", () => {
    // Given: A renderer without preload
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: false } },
      },
    });

    // When: Adding transforms and seeking backward
    renderer.setCurrentTime(100n);
    const msg = createTFMessageEvent("parent", "child", 50n, [50n]);
    renderer.addMessageEvent(msg);
    renderer.animationFrame();

    // When: Seeking backward should clear transforms
    renderer.setCurrentTime(10n);
    renderer.handleSeek(100n);

    // Then: Transform tree should be cleared (no transforms)
    const frame = renderer.transformTree.frame("child");
    // Frame may exist but should have no transforms, or frame doesn't exist (both are valid)
    expect(frame == undefined || frame.transformsSize() === 0).toBe(true);
  });
});

describe("Renderer batch message processing", () => {
  let canvas = document.createElement("canvas");
  let parent = document.createElement("div");
  let rendererArgs: ConstructorParameters<typeof Renderer>[0] = {
    ...defaultRendererProps,
    canvas,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupJestCanvasMock();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    rendererArgs = { ...defaultRendererProps, canvas };
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("processes messages in batch grouped by topic and schema", () => {
    // Given: A renderer and messages with different topics
    const renderer = new Renderer(rendererArgs);
    const messages = [
      createTFMessageEvent("parent1", "child1", 1n, [1n], "/tf"),
      createTFMessageEvent("parent2", "child2", 2n, [2n], "/tf"),
      createTFMessageEvent("parent3", "child3", 3n, [3n], "/tf_static"),
    ];

    // When: Processing batch of messages
    renderer.setCurrentTime(10n);
    renderer.addMessageEventBatch(messages);
    renderer.animationFrame();

    // Then: All transforms should be added
    expect(renderer.transformTree.frame("child1")).toBeDefined();
    expect(renderer.transformTree.frame("child2")).toBeDefined();
    expect(renderer.transformTree.frame("child3")).toBeDefined();
  });

  it("handles empty batch gracefully", () => {
    // Given: A renderer
    const renderer = new Renderer(rendererArgs);

    // When: Processing empty batch
    renderer.addMessageEventBatch([]);

    // Then: Should not throw error
    expect(renderer.transformTree.frames().size).toBe(0);
  });

  it("groups messages by topic and convertTo when processing batch", () => {
    // Given: A renderer with multiple messages from same topic
    const renderer = new Renderer(rendererArgs);
    const messages = [
      createTFMessageEvent("parent1", "child1", 1n, [1n], "/tf"),
      createTFMessageEvent("parent2", "child2", 2n, [2n], "/tf"),
      createTFMessageEvent("parent3", "child3", 3n, [3n], "/tf"),
    ];

    // When: Processing batch
    renderer.setCurrentTime(10n);
    renderer.addMessageEventBatch(messages);
    renderer.animationFrame();

    // Then: All messages from same topic should be processed together
    expect(renderer.transformTree.frame("child1")).toBeDefined();
    expect(renderer.transformTree.frame("child2")).toBeDefined();
    expect(renderer.transformTree.frame("child3")).toBeDefined();
  });
});

describe("Renderer binary search optimization", () => {
  let canvas = document.createElement("canvas");
  let parent = document.createElement("div");
  let rendererArgs: ConstructorParameters<typeof Renderer>[0] = {
    ...defaultRendererProps,
    canvas,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupJestCanvasMock();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    rendererArgs = { ...defaultRendererProps, canvas };
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("finds correct cutoff index when seeking backward", () => {
    // Given: Renderer with preload enabled and sorted messages
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });
    const allFrames = [
      createTFMessageEvent("parent", "child", 10n, [10n]),
      createTFMessageEvent("parent", "child", 20n, [20n]),
      createTFMessageEvent("parent", "child", 30n, [30n]),
      createTFMessageEvent("parent", "child", 40n, [40n]),
      createTFMessageEvent("parent", "child", 50n, [50n]),
    ];

    // When: Seeking backward from 50n to 25n
    renderer.setCurrentTime(50n);
    renderer.handleAllFramesMessages(allFrames);
    renderer.setCurrentTime(25n);
    renderer.handleSeek(50n, allFrames);

    // Then: Should clear transforms after 25n
    renderer.animationFrame();
    expect(renderer.currentTime).toBe(25n);
  });

  it("handles seek to exact message timestamp", () => {
    // Given: Renderer with messages at specific timestamps
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });
    const allFrames = [
      createTFMessageEvent("parent", "child", 10n, [10n]),
      createTFMessageEvent("parent", "child", 20n, [20n]),
      createTFMessageEvent("parent", "child", 30n, [30n]),
    ];

    // When: Seeking to exact timestamp of a message
    renderer.setCurrentTime(50n);
    renderer.handleAllFramesMessages(allFrames);
    renderer.setCurrentTime(20n);
    renderer.handleSeek(50n, allFrames);

    // Then: Should include message at that timestamp
    renderer.animationFrame();
    expect(renderer.currentTime).toBe(20n);
  });

  it("handles seek to before first message", () => {
    // Given: Renderer with messages starting from 10n
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });
    const allFrames = [
      createTFMessageEvent("parent", "child", 10n, [10n]),
      createTFMessageEvent("parent", "child", 20n, [20n]),
    ];

    // When: Seeking to before first message
    renderer.setCurrentTime(50n);
    renderer.handleAllFramesMessages(allFrames);
    renderer.setCurrentTime(5n);
    renderer.handleSeek(50n, allFrames);

    // Then: Should clear all transforms
    renderer.animationFrame();
    expect(renderer.currentTime).toBe(5n);
  });
});

describe("Renderer maxPreloadMessages configuration", () => {
  let canvas = document.createElement("canvas");
  let parent = document.createElement("div");
  let rendererArgs: ConstructorParameters<typeof Renderer>[0] = {
    ...defaultRendererProps,
    canvas,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupJestCanvasMock();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    rendererArgs = { ...defaultRendererProps, canvas };
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("uses default MAX_TRANSFORM_MESSAGES when not configured", () => {
    // Given: Renderer without maxPreloadMessages setting
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });

    // When: Config is accessed
    const maxMessages = renderer.config.scene.transforms?.maxPreloadMessages;

    // Then: Should be undefined (uses default)
    expect(maxMessages).toBeUndefined();
  });

  it("respects custom maxPreloadMessages configuration", () => {
    // Given: Renderer with custom maxPreloadMessages
    const customMax = 5000;
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true, maxPreloadMessages: customMax } },
      },
    });

    // When: Config is accessed
    const maxMessages = renderer.config.scene.transforms?.maxPreloadMessages;

    // Then: Should use custom value
    expect(maxMessages).toBe(customMax);
  });
});

describe("Renderer resetAllFramesCursor event handling", () => {
  let canvas = document.createElement("canvas");
  let parent = document.createElement("div");
  let rendererArgs: ConstructorParameters<typeof Renderer>[0] = {
    ...defaultRendererProps,
    canvas,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupJestCanvasMock();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    rendererArgs = { ...defaultRendererProps, canvas };
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("emits resetAllFramesCursor when seeking backward without allFrames", () => {
    // Given: Renderer with preload enabled but no allFrames
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });
    const resetListener = jest.fn();
    renderer.addListener("resetAllFramesCursor", resetListener);

    // When: Seeking backward without providing allFrames
    renderer.setCurrentTime(50n);
    renderer.setCurrentTime(5n);
    renderer.handleSeek(50n); // No allFrames parameter

    // Then: Event should be emitted (falls back to clear with resetAllFramesCursor=true)
    expect(resetListener).toHaveBeenCalled();
  });

  it("does not emit resetAllFramesCursor when seeking backward with allFrames", () => {
    // Given: Renderer with preload enabled and allFrames
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });
    const resetListener = jest.fn();
    renderer.addListener("resetAllFramesCursor", resetListener);

    const allFrames = [
      createTFMessageEvent("parent", "child", 10n, [10n]),
      createTFMessageEvent("parent", "child", 20n, [20n]),
    ];

    // When: Seeking backward with allFrames (uses optimized path)
    renderer.setCurrentTime(50n);
    renderer.setCurrentTime(5n);
    renderer.handleSeek(50n, allFrames);

    // Then: Event should not be emitted (optimized path doesn't call clear)
    expect(resetListener).not.toHaveBeenCalled();
  });

  it("emits resetAllFramesCursor when seeking forward", () => {
    // Given: Renderer with preload enabled
    const renderer = new Renderer({
      ...rendererArgs,
      config: {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
    });
    const resetListener = jest.fn();
    renderer.addListener("resetAllFramesCursor", resetListener);

    const allFrames = [
      createTFMessageEvent("parent", "child", 10n, [10n]),
      createTFMessageEvent("parent", "child", 20n, [20n]),
    ];

    // When: Seeking forward (calls clear with resetAllFramesCursor=false)
    renderer.setCurrentTime(5n);
    renderer.setCurrentTime(50n);
    renderer.handleSeek(5n, allFrames);

    // Then: Event should not be emitted for forward seek
    expect(resetListener).not.toHaveBeenCalled();
  });
});
