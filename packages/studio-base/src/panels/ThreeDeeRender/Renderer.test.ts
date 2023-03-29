/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromNanoSec } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import { Renderer, RendererConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/Renderer";
import { DEFAULT_CAMERA_STATE } from "@foxglove/studio-base/panels/ThreeDeeRender/camera";
import { DEFAULT_PUBLISH_SETTINGS } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/CoreSettings";
import { TFMessage } from "@foxglove/studio-base/panels/ThreeDeeRender/ros";

// Jest doesn't support ES module imports fully yet, so we need to mock the wasm file
jest.mock("three/examples/jsm/libs/draco/draco_decoder.wasm", () => "");

// We need to mock the WebGLRenderer because it's not available in jsdom
// only mocking what we currently use
jest.mock("three", () => {
  const THREE = jest.requireActual("three");
  return {
    ...THREE,
    WebGLRenderer: jest.fn().mockReturnValue({
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
      getDrawingBufferSize: jest.fn().mockReturnValue({ width: 100, height: 100 }),
    }),
  };
});

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

const defaultRendererConfig: RendererConfig = {
  cameraState: DEFAULT_CAMERA_STATE,
  followMode: "follow-pose",
  followTf: undefined,
  scene: {},
  transforms: {},
  topics: {},
  layers: {},
  publish: DEFAULT_PUBLISH_SETTINGS,
};

const tf = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

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
    transform: tf,
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

describe("Renderer", () => {
  let canvas = document.createElement("canvas");
  let parent = document.createElement("div");
  beforeEach(() => {
    jest.clearAllMocks();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
  });
  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("constructs a renderer without error", () => {
    expect(() => new Renderer(canvas, defaultRendererConfig, "3d")).not.toThrow();
  });
  it("tfPreloading off:  when seeking to before currentTime, clears transform tree", () => {
    // This test is meant accurately represent the flow of seek through the react component

    const renderer = new Renderer(
      canvas,
      {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: false } },
      },
      "3d",
    );
    let currentFrame = [];

    // initialize renderer with transforms

    // first frame
    let currentTime = 5n;
    const beforeHeader = createTFMessageEvent("root", "before", currentTime, [currentTime - 2n]);
    // transform with headerstamp before currentTime
    currentFrame = [beforeHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => renderer.addMessageEvent(msg));

    // second frame
    currentTime = 6n;
    const onHeader = createTFMessageEvent("root", "on", currentTime, [currentTime]);
    // transform with headerstamp on currentTime
    currentFrame = [onHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => renderer.addMessageEvent(msg));

    // third frame
    currentTime = 7n;
    const afterHeader = createTFMessageEvent("root", "after", currentTime, [currentTime + 2n]);
    // transform with headerstamp after currentTime
    currentFrame = [afterHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => renderer.addMessageEvent(msg));

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
    currentFrame.forEach((msg) => renderer.addMessageEvent(msg));

    expect(renderer.transformTree.frame("before")).not.toBeUndefined();
  });
  it("tfPreloading off: when seeking to time after currentTime, does not clear transform tree", () => {
    // This test is meant accurately represent the flow of seek through the react component

    const renderer = new Renderer(
      canvas,
      {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: false } },
      },
      "3d",
    );
    let currentFrame = [];

    // initialize renderer with transforms

    // first frame
    let currentTime = 5n;
    const beforeHeader = createTFMessageEvent("root", "before", currentTime, [currentTime - 2n]);
    // transform with headerstamp before currentTime
    currentFrame = [beforeHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => renderer.addMessageEvent(msg));

    // second frame
    currentTime = 6n;
    const onHeader = createTFMessageEvent("root", "on", currentTime, [currentTime]);
    // transform with headerstamp on currentTime
    currentFrame = [onHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => renderer.addMessageEvent(msg));

    // third frame
    currentTime = 7n;
    const afterHeader = createTFMessageEvent("root", "after", currentTime, [currentTime + 2n]);
    // transform with headerstamp after currentTime
    currentFrame = [afterHeader];
    renderer.setCurrentTime(currentTime);
    currentFrame.forEach((msg) => renderer.addMessageEvent(msg));

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
    currentFrame.forEach((msg) => renderer.addMessageEvent(msg));

    expect(renderer.transformTree.frame("before")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).not.toBeUndefined();
    expect(renderer.transformTree.frame("after")).not.toBeUndefined();
    expect(renderer.transformTree.frame("seekOn")).not.toBeUndefined();
  });
  it("tfPreloading on:  when seeking to before currentTime, clears transform tree and repopulates it up to receiveTime from allFrames", () => {
    const renderer = new Renderer(
      canvas,
      {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
      "3d",
    );
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
    expect(renderer.transformTree.frame("before4")).not.toBeUndefined();
    expect(renderer.transformTree.frame("before2")).not.toBeUndefined();
    expect(renderer.transformTree.frame("on")).toBeUndefined();
    expect(renderer.transformTree.frame("after2")).toBeUndefined();
    expect(renderer.transformTree.frame("after4")).toBeUndefined();
  });
  it("tfPreloading on: does not clear transform tree when seeking to after", () => {
    const renderer = new Renderer(
      canvas,
      {
        ...defaultRendererConfig,
        scene: { transforms: { enablePreloading: true } },
      },
      "3d",
    );
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
  beforeEach(() => {
    jest.clearAllMocks();
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
  });
  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  it("constructs a renderer without error", () => {
    expect(() => new Renderer(canvas, defaultRendererConfig, "3d")).not.toThrow();
  });
  it("does not add in allFramesMessages if no messages are before currentTime", () => {
    const renderer = new Renderer(canvas, defaultRendererConfig, "3d");

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
    const renderer = new Renderer(canvas, defaultRendererConfig, "3d");

    const msgs = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const currentTime = 4n;
    const addMessageEventMock = jest.spyOn(renderer, "addMessageEvent");
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(msgs);

    expect(addMessageEventMock).toHaveBeenCalledTimes(5);
  });
  it("adds later messages after currentTime is updated", () => {
    const renderer = new Renderer(canvas, defaultRendererConfig, "3d");

    const msgs = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const currentTime = 4n;
    const addMessageEventMock = jest.spyOn(renderer, "addMessageEvent");
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventMock).toHaveBeenCalledTimes(5);
    renderer.setCurrentTime(5n);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventMock).toHaveBeenCalledTimes(6);
  });
  it("reads all messages when last message receiveTime is before currentTime", () => {
    const renderer = new Renderer(canvas, defaultRendererConfig, "3d");

    const msgs = [];
    for (let i = 0; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const currentTime = 11n;
    const addMessageEventMock = jest.spyOn(renderer, "addMessageEvent");
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventMock).toHaveBeenCalledTimes(10);
  });
  it("reads reads new messages when allFrames array is added to", () => {
    const renderer = new Renderer(canvas, defaultRendererConfig, "3d");

    const msgs = [];
    let i = 0;
    for (i; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const currentTime = 11n;
    const addMessageEventMock = jest.spyOn(renderer, "addMessageEvent");
    renderer.setCurrentTime(currentTime);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventMock).toHaveBeenCalledTimes(10);
    for (i; i < 20; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    renderer.handleAllFramesMessages(msgs);
    // only two more are before or equal to currentTime
    expect(addMessageEventMock).toHaveBeenCalledTimes(12);
  });
  it("doesn't read messages when currentTime is updated but no more receiveTimes are past it", () => {
    const renderer = new Renderer(canvas, defaultRendererConfig, "3d");

    const msgs = [];
    let i = 0;
    for (i; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const addMessageEventMock = jest.spyOn(renderer, "addMessageEvent");
    renderer.setCurrentTime(11n);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventMock).toHaveBeenCalledTimes(10);

    renderer.setCurrentTime(12n);
    const newMessagesHandled = renderer.handleAllFramesMessages(msgs);
    expect(newMessagesHandled).toBeFalsy();
    expect(addMessageEventMock).toHaveBeenCalledTimes(10);
  });
  it("adds all messages again after cursor is cleared", () => {
    const renderer = new Renderer(canvas, defaultRendererConfig, "3d");

    const msgs = [];
    let i = 0;
    for (i; i < 10; i++) {
      msgs.push(createTFMessageEvent("a", "b", BigInt(i), [BigInt(i)]));
    }
    const addMessageEventMock = jest.spyOn(renderer, "addMessageEvent");
    renderer.setCurrentTime(11n);
    renderer.handleAllFramesMessages(msgs);
    expect(addMessageEventMock).toHaveBeenCalledTimes(10);

    renderer.clear({ resetAllFramesCursor: true });
    const newMessagesHandled = renderer.handleAllFramesMessages(msgs);
    expect(newMessagesHandled).toBeTruthy();
    // will read all messages in twice
    expect(addMessageEventMock).toHaveBeenCalledTimes(20);
  });
});
