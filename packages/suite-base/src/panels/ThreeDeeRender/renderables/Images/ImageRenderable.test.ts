/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as THREE from "three";

import { PinholeCameraModel } from "@lichtblick/den/image";
import { H265SliceType } from "@lichtblick/den/video";
import { IRenderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/IRenderer";
import H265FrameBuilder from "@lichtblick/suite-base/testing/builders/H265FrameBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import {
  ImageRenderable,
  IMAGE_RENDERABLE_DEFAULT_SETTINGS,
  ImageUserData,
} from "./ImageRenderable";
import { CompressedVideo } from "./ImageTypes";

const mockAdd = jest.fn();
const mockAddToTopic = jest.fn();
const mockRemove = jest.fn();
const mockRemoveFromTopic = jest.fn();

// Mocked dependencies
const mockRenderer: IRenderer = {
  queueAnimationFrame: jest.fn(),
  normalizeFrameId: jest.fn((id) => id),
  settings: {
    errors: {
      add: mockAdd,
      addToTopic: mockAddToTopic,
      remove: mockRemove,
      removeFromTopic: mockRemoveFromTopic,
    },
  },
} as unknown as IRenderer;

const mockUserData: ImageUserData = {
  topic: BasicBuilder.string(),
  settings: { ...IMAGE_RENDERABLE_DEFAULT_SETTINGS },
  firstMessageTime: BigInt(0),
  cameraInfo: undefined,
  cameraModel: undefined,
  image: undefined,
  texture: undefined,
  material: undefined,
  geometry: undefined,
  mesh: undefined,
  frameId: "frame",
  messageTime: 0n,
  receiveTime: 0n,
  pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
  settingsPath: [],
};

// Simplest image format test case
const sampleImage = {
  format: "jpeg",
  data: new Uint8Array([1, 2, 3]), // fake data
  header: { frame_id: "camera", stamp: { sec: 0, nsec: 1 } },
};

const h265Keyframe = H265FrameBuilder.keyframeWithParameterSets();
const h265DeltaFrame = H265FrameBuilder.deltaFrame();
const h265BFrame = H265FrameBuilder.deltaFrameWithPps(H265SliceType.B);

function createH265Frame(data: Uint8Array, timestamp = { sec: 0, nsec: 1 }) {
  return H265FrameBuilder.frame({ data, frame_id: "camera", timestamp });
}

function createDecodedVideoFrame(timestamp = 0): VideoFrame {
  return {
    timestamp,
    codedWidth: 640,
    codedHeight: 480,
    close: jest.fn(),
    clone: jest.fn().mockImplementation(function (this: VideoFrame) {
      return this;
    }),
  } as unknown as VideoFrame;
}

describe("ImageRenderable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should instantiate and set settings", () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    expect(renderable).toBeInstanceOf(ImageRenderable);

    const newSettings = { ...IMAGE_RENDERABLE_DEFAULT_SETTINGS, distance: 2 };
    renderable.setSettings(newSettings);
    expect(renderable.userData.settings.distance).toBe(2);
  });

  it("should set and decode image", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    renderable.setImage(sampleImage);
    expect(renderable.userData.image).toBe(sampleImage);
    expect(renderable.getDecodedImage()).toBe(undefined);

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(renderable.userData.image!, 100);
    expect(renderable.getDecodedImage()).toBeInstanceOf(ImageBitmap);
  });

  it("should dispose resources", () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    renderable.userData.texture = new THREE.Texture();
    renderable.userData.material = new THREE.ShaderMaterial();
    renderable.userData.geometry = new THREE.PlaneGeometry();
    const close = jest.fn();
    renderable.videoPlayer = {
      close,
    } as unknown as ImageRenderable["videoPlayer"];

    // @ts-expect-error isDisposed is protected, but ok to use on tests
    expect(renderable.isDisposed()).toBe(false);

    renderable.dispose();

    expect(close).toHaveBeenCalled();
    // @ts-expect-error isDisposed is protected, but ok to use on tests
    expect(renderable.isDisposed()).toBe(true);
  });

  it("should set a new brightness value", () => {
    const newBrightnessValue = BasicBuilder.number();
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });

    renderable.userData.texture = new THREE.Texture();
    renderable.userData.material = new THREE.ShaderMaterial();
    renderable.setSettings({ ...renderable.userData.settings, brightness: newBrightnessValue });
    renderable.userData.geometry = new THREE.PlaneGeometry();

    expect(renderable.userData.settings.brightness).toBe(newBrightnessValue);
  });

  it("should set a new contrast value", () => {
    const newContrastValue = BasicBuilder.number();
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });

    renderable.userData.texture = new THREE.Texture();
    renderable.userData.material = new THREE.ShaderMaterial();
    renderable.setSettings({ ...renderable.userData.settings, contrast: newContrastValue });
    renderable.userData.geometry = new THREE.PlaneGeometry();

    expect(renderable.userData.settings.contrast).toBe(newContrastValue);
  });

  it("should set camera model", () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const model = new PinholeCameraModel({
      width: 100,
      height: 100,
      binning_x: 0,
      binning_y: 0,
      D: BasicBuilder.multiple(() => BasicBuilder.number({ min: 1 }), 8),
      distortion_model: "",
      K: [],
      P: BasicBuilder.multiple(() => BasicBuilder.number({ min: 1 }), 12),
      R: [],
      roi: {
        x_offset: 0,
        y_offset: 0,
        height: 0,
        width: 0,
        do_rectify: false,
      },
    });
    renderable.setCameraModel(model);
    expect(renderable.userData.cameraModel).toBe(model);
  });
});

describe("ImageRenderable error handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should call renderer error methods on addError", () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, {
      ...mockUserData,
    });

    const mockErrorKey = BasicBuilder.string();
    const mockErrorMessage = BasicBuilder.string();

    // @ts-expect-error addError is protected, but ok to use on tests
    renderable.addError(mockErrorKey, mockErrorMessage);

    expect(mockAdd).toHaveBeenCalledWith(
      ["imageMode", "imageTopic"],
      mockErrorKey,
      mockErrorMessage,
    );
    expect(mockAddToTopic).toHaveBeenCalledWith(mockUserData.topic, mockErrorKey, mockErrorMessage);
  });

  it("should not call addError in case of renderable is disposed", () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, {
      ...mockUserData,
    });

    renderable.dispose();

    // @ts-expect-error addError is protected, but ok to use on tests
    renderable.addError(BasicBuilder.string(), BasicBuilder.string());

    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockAddToTopic).not.toHaveBeenCalled();
  });

  it("should call renderer error methods on removeError", () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });

    // @ts-expect-error removeError is protected, but ok to use on tests
    renderable.removeError("decode");
    expect(mockRemove).toHaveBeenCalledWith(["imageMode", "imageTopic"], "decode");
    expect(mockRemoveFromTopic).toHaveBeenCalledWith(mockUserData.topic, "decode");
  });

  it("should initialize h265 decoding for a keyframe with VPS SPS PPS", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const init = jest.fn().mockResolvedValue(undefined);
    const decodeFrames = jest.fn().mockResolvedValue({
      type: "target",
      frame: createDecodedVideoFrame(),
    });
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(false),
      init,
      decode: jest.fn(),
      decodeFrames,
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue(undefined),
      resetForSeek: jest.fn(),
    } as unknown as ImageRenderable["videoPlayer"];

    const keyframe = createH265Frame(h265Keyframe);

    const originalCreateImageBitmap = self.createImageBitmap;
    const createImageBitmapSpy = jest.fn().mockResolvedValue(new ImageBitmap());
    self.createImageBitmap = createImageBitmapSpy;

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(keyframe, 100);

    expect(init).toHaveBeenCalledWith({ codec: "hvc1.1.6.L93.B0" });
    self.createImageBitmap = originalCreateImageBitmap;
  });

  it("should report detailed h265 diagnostics before decoder init", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(false),
      init: jest.fn(),
      decode: jest.fn(),
      decodeFrames: jest.fn(),
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue(undefined),
      resetForSeek: jest.fn(),
    } as unknown as ImageRenderable["videoPlayer"];

    await expect(
      // @ts-expect-error decodeImage is protected, but ok to use on tests
      renderable.decodeImage(createH265Frame(new Uint8Array([0x01, 0x02, 0x03])), 100),
    ).rejects.toThrow("Waiting for keyframe (unsupported H.265 bitstream format)");
  });

  it("should wait silently for h265 frames without decoder config before init", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const lastImageBitmap = new ImageBitmap();
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(false),
      init: jest.fn(),
      decode: jest.fn(),
      decodeFrames: jest.fn(),
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue(undefined),
      resetForSeek: jest.fn(),
      lastImageBitmap,
      lastVideoFrame: undefined,
      awaitTargetFrame: jest.fn(),
    } as unknown as ImageRenderable["videoPlayer"];

    const bitmap =
      // @ts-expect-error decodeImage is protected, but ok to use on tests
      await renderable.decodeImage(createH265Frame(h265DeltaFrame), 100);

    expect(bitmap).not.toBe(lastImageBitmap);
  });

  it("should wait silently on h265 delta frames before decoder init", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const init = jest.fn().mockResolvedValue(undefined);
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(false),
      init,
      decode: jest.fn(),
      decodeFrames: jest.fn().mockResolvedValue({
        type: "target",
        frame: createDecodedVideoFrame(),
      }),
      codedSize: jest.fn(),
      lastImageBitmap: undefined,
      decoderConfig: jest.fn().mockReturnValue(undefined),
      resetForSeek: jest.fn(),
      awaitTargetFrame: jest.fn(),
    } as unknown as ImageRenderable["videoPlayer"];

    const originalCreateImageBitmap = self.createImageBitmap;
    const createImageBitmapSpy = jest.fn().mockResolvedValue(new ImageBitmap());
    self.createImageBitmap = createImageBitmapSpy;

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(h265Keyframe), 100);
    const bitmap =
      // @ts-expect-error decodeImage is protected, but ok to use on tests
      await renderable.decodeImage(createH265Frame(h265DeltaFrame), 100);

    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(init).toHaveBeenCalledTimes(1);
    self.createImageBitmap = originalCreateImageBitmap;
  });

  it("should reset the video player when timestamps go backwards", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const resetForSeek = jest.fn();
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(false),
      init: jest.fn().mockResolvedValue(undefined),
      decode: jest.fn(),
      decodeFrames: jest.fn().mockResolvedValue({
        type: "target",
        frame: createDecodedVideoFrame(),
      }),
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue(undefined),
      resetForSeek,
      lastImageBitmap: undefined,
      awaitTargetFrame: jest.fn(),
    } as unknown as ImageRenderable["videoPlayer"];

    const keyframe = h265Keyframe;

    const originalCreateImageBitmap = self.createImageBitmap;
    const createImageBitmapSpy = jest.fn().mockResolvedValue(new ImageBitmap());
    self.createImageBitmap = createImageBitmapSpy;

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(keyframe, { sec: 2, nsec: 0 }), 100);
    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(keyframe, { sec: 1, nsec: 0 }), 100);

    expect(resetForSeek).toHaveBeenCalledTimes(1);
    self.createImageBitmap = originalCreateImageBitmap;
  });

  it("should ignore small backward timestamp jitter for h265 frames", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const resetForSeek = jest.fn();
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(false),
      init: jest.fn().mockResolvedValue(undefined),
      decode: jest.fn(),
      decodeFrames: jest.fn().mockResolvedValue({
        type: "target",
        frame: createDecodedVideoFrame(),
      }),
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue(undefined),
      resetForSeek,
      lastImageBitmap: undefined,
      awaitTargetFrame: jest.fn(),
    } as unknown as ImageRenderable["videoPlayer"];

    const originalCreateImageBitmap = self.createImageBitmap;
    const createImageBitmapSpy = jest.fn().mockResolvedValue(new ImageBitmap());
    self.createImageBitmap = createImageBitmapSpy;

    const keyframe = h265Keyframe;

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(keyframe, { sec: 2, nsec: 10_000_000 }), 100);
    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(keyframe, { sec: 2, nsec: 8_000_000 }), 100);

    expect(resetForSeek).not.toHaveBeenCalled();
    self.createImageBitmap = originalCreateImageBitmap;
  });

  it("should serialize h264 video decoding and keep only the latest pending frame", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const decodeResolvers = new Map<number, () => void>();
    const decodeOrder: number[] = [];

    jest.spyOn(renderable, "update").mockImplementation(() => undefined);

    const keyframe = h265Keyframe;

    let resolveLatestDecoded!: () => void;
    const latestDecoded = new Promise<void>((resolve) => {
      resolveLatestDecoded = resolve;
    });
    let resolveLatestDecodeStarted!: () => void;
    const latestDecodeStarted = new Promise<void>((resolve) => {
      resolveLatestDecodeStarted = resolve;
    });

    jest
      .spyOn(renderable as unknown as { decodeImage: jest.Mock }, "decodeImage")
      .mockImplementation(
        async (
          image: (typeof mockUserData)["image"] & { timestamp: { sec: number; nsec: number } },
        ) => {
          const timestampMicros = Number(
            (BigInt(image.timestamp.sec) * 1000000000n + BigInt(image.timestamp.nsec)) / 1000n,
          );
          decodeOrder.push(timestampMicros);
          if (timestampMicros === 33333) {
            resolveLatestDecodeStarted();
          }
          await new Promise<void>((resolve) => {
            decodeResolvers.set(timestampMicros, resolve);
          });
          return {} as ImageData;
        },
      );

    renderable.setImage({ ...createH265Frame(keyframe, { sec: 0, nsec: 0 }), format: "h264" });
    renderable.setImage({
      ...createH265Frame(keyframe, { sec: 0, nsec: 16666666 }),
      format: "h264",
    });
    renderable.setImage(
      { ...createH265Frame(keyframe, { sec: 0, nsec: 33333333 }), format: "h264" },
      undefined,
      () => {
        resolveLatestDecoded();
      },
    );
    await Promise.resolve();

    expect(decodeOrder).toEqual([0]);

    decodeResolvers.get(0)?.();
    await latestDecodeStarted;
    expect(decodeOrder).toEqual([0, 33333]);

    decodeResolvers.get(33333)?.();
    await latestDecoded;
  });

  it("should decode every pending h265 frame in order", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    jest.spyOn(renderable, "update").mockImplementation(() => undefined);

    const decode = jest
      .fn<Promise<VideoFrame | undefined>, [Uint8Array, number, "key" | "delta"]>()
      .mockResolvedValueOnce(createDecodedVideoFrame(0))
      .mockResolvedValueOnce(createDecodedVideoFrame(16666))
      .mockResolvedValueOnce(createDecodedVideoFrame(33333));
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      init: jest.fn().mockResolvedValue(undefined),
      decode,
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue({ codec: "hvc1.1.6.L93.B0" }),
      resetForSeek: jest.fn(),
      lastImageBitmap: undefined,
      lastVideoFrame: undefined,
    } as unknown as ImageRenderable["videoPlayer"];

    const originalCreateImageBitmap = self.createImageBitmap;
    const createImageBitmapSpy = jest.fn().mockResolvedValue(new ImageBitmap());
    self.createImageBitmap = createImageBitmapSpy;

    let releaseFirstDecode!: () => void;
    const firstDecodeBlocked = new Promise<void>((resolve) => {
      releaseFirstDecode = resolve;
    });
    let latestDecoded!: () => void;
    const latestDecodedPromise = new Promise<void>((resolve) => {
      latestDecoded = resolve;
    });

    jest
      .spyOn(renderable as unknown as { decodeImage: jest.Mock }, "decodeImage")
      .mockImplementation(async (image: CompressedVideo, resizeWidth?: number) => {
        if (image.timestamp.sec === 0 && image.timestamp.nsec === 0) {
          await firstDecodeBlocked;
        }
        return await (
          ImageRenderable.prototype as unknown as {
            decodeImage: (
              image: CompressedVideo,
              resizeWidth?: number,
            ) => Promise<ImageBitmap | ImageData>;
          }
        ).decodeImage.call(renderable, image, resizeWidth);
      });

    renderable.setImage(createH265Frame(h265Keyframe, { sec: 0, nsec: 0 }));
    renderable.setImage(createH265Frame(h265DeltaFrame, { sec: 0, nsec: 16666666 }));
    renderable.setImage(
      createH265Frame(h265DeltaFrame, { sec: 0, nsec: 33333333 }),
      undefined,
      () => {
        latestDecoded();
      },
    );
    await Promise.resolve();

    releaseFirstDecode();
    await latestDecodedPromise;

    expect(decode).toHaveBeenNthCalledWith(1, expect.any(Uint8Array), 0, "key");
    expect(decode).toHaveBeenNthCalledWith(2, expect.any(Uint8Array), 16666, "delta");
    expect(decode).toHaveBeenNthCalledWith(3, expect.any(Uint8Array), 33333, "delta");

    self.createImageBitmap = originalCreateImageBitmap;
  });

  it("should skip duplicate pending h265 frame timestamps", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    jest.spyOn(renderable, "update").mockImplementation(() => undefined);

    const decode = jest
      .fn<Promise<VideoFrame | undefined>, [Uint8Array, number, "key" | "delta"]>()
      .mockResolvedValueOnce(createDecodedVideoFrame(0))
      .mockResolvedValueOnce(createDecodedVideoFrame(16666));
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      init: jest.fn().mockResolvedValue(undefined),
      decode,
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue({ codec: "hvc1.1.6.L93.B0" }),
      resetForSeek: jest.fn(),
      lastImageBitmap: undefined,
      lastVideoFrame: undefined,
    } as unknown as ImageRenderable["videoPlayer"];

    const originalCreateImageBitmap = self.createImageBitmap;
    self.createImageBitmap = jest.fn().mockResolvedValue(new ImageBitmap());

    let latestDecoded!: () => void;
    const latestDecodedPromise = new Promise<void>((resolve) => {
      latestDecoded = resolve;
    });

    renderable.setImage(createH265Frame(h265Keyframe, { sec: 0, nsec: 0 }));
    renderable.setImage(createH265Frame(h265Keyframe, { sec: 0, nsec: 0 }));
    renderable.setImage(
      createH265Frame(h265DeltaFrame, { sec: 0, nsec: 16666666 }),
      undefined,
      () => {
        latestDecoded();
      },
    );
    await latestDecodedPromise;

    expect(decode).toHaveBeenCalledTimes(2);
    expect(decode).toHaveBeenNthCalledWith(1, expect.any(Uint8Array), 0, "key");
    expect(decode).toHaveBeenNthCalledWith(2, expect.any(Uint8Array), 16666, "delta");

    self.createImageBitmap = originalCreateImageBitmap;
  });

  it("should reuse the last image bitmap when h265 decode times out", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const lastImageBitmap = new ImageBitmap();
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      init: jest.fn().mockResolvedValue(undefined),
      decode: jest.fn().mockResolvedValue(undefined),
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue({ codec: "hvc1.1.6.L93.B0" }),
      resetForSeek: jest.fn(),
      lastImageBitmap,
      lastVideoFrame: undefined,
    } as unknown as ImageRenderable["videoPlayer"];

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    const bitmap = await renderable.decodeImage(
      createH265Frame(h265Keyframe, { sec: 0, nsec: 0 }),
      100,
    );

    expect(bitmap).toBe(lastImageBitmap);
  });

  it("should reset the video player when a decode error is reported", () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const resetForSeek = jest.fn();
    renderable.videoPlayer = {
      resetForSeek,
    } as unknown as ImageRenderable["videoPlayer"];

    // @ts-expect-error handleVideoPlayerError is protected, but ok to use on tests
    renderable.handleVideoPlayerError(new Error("Decoding error"));
    (console.error as jest.Mock).mockClear();

    expect(resetForSeek).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(
      ["imageMode", "imageTopic"],
      "CreateBitmap",
      "Error decoding video: Decoding error",
    );
  });

  it("should skip unsupported h265 B frames", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const lastImageBitmap = new ImageBitmap();
    const decode = jest.fn();
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      init: jest.fn().mockResolvedValue(undefined),
      decode,
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue({ codec: "hvc1.1.6.L93.B0" }),
      resetForSeek: jest.fn(),
      lastImageBitmap,
      lastVideoFrame: undefined,
    } as unknown as ImageRenderable["videoPlayer"];

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    const bitmap = await renderable.decodeImage(
      createH265Frame(h265BFrame, { sec: 0, nsec: 33333333 }),
      100,
    );

    expect(bitmap).toBe(lastImageBitmap);
    expect(decode).not.toHaveBeenCalled();
  });

  it("should decode continuous h265 frames one-by-one after the nearest keyframe", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const decode = jest
      .fn<Promise<VideoFrame | undefined>, [Uint8Array, number, "key" | "delta"]>()
      .mockResolvedValueOnce(createDecodedVideoFrame(0))
      .mockResolvedValueOnce(createDecodedVideoFrame(16666))
      .mockResolvedValueOnce(createDecodedVideoFrame(33333));
    const init = jest.fn().mockResolvedValue(undefined);
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      init,
      decode,
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue({ codec: "hvc1.1.6.L93.B0" }),
      resetForSeek: jest.fn(),
      lastImageBitmap: undefined,
      lastVideoFrame: undefined,
    } as unknown as ImageRenderable["videoPlayer"];

    const originalCreateImageBitmap = self.createImageBitmap;
    const createImageBitmapSpy = jest.fn().mockResolvedValue(new ImageBitmap());
    self.createImageBitmap = createImageBitmapSpy;

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(h265Keyframe, { sec: 0, nsec: 0 }), 100);
    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(h265DeltaFrame, { sec: 0, nsec: 16666666 }), 100);
    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(h265DeltaFrame, { sec: 0, nsec: 33333333 }), 100);

    expect(decode).toHaveBeenNthCalledWith(1, expect.any(Uint8Array), 0, "key");
    expect(decode).toHaveBeenNthCalledWith(2, expect.any(Uint8Array), 16666, "delta");
    expect(decode).toHaveBeenNthCalledWith(3, expect.any(Uint8Array), 33333, "delta");
    expect(init).not.toHaveBeenCalled();

    self.createImageBitmap = originalCreateImageBitmap;
  });

  it("should replay h265 GOP when seeking to a P frame", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const replayFrame = createDecodedVideoFrame(33333);
    const consumeData = (data: Uint8Array) => {
      expect(data.byteLength).toBeGreaterThan(0);
      data.fill(0);
    };
    const decode = jest.fn(
      async (data: Uint8Array, timestampMicros: number): Promise<VideoFrame | undefined> => {
        consumeData(data);
        return createDecodedVideoFrame(timestampMicros);
      },
    );
    const decodeFrames = jest.fn(async (frames: { data: Uint8Array }[]) => {
      for (const frame of frames) {
        expect(frame.data.byteLength).toBeGreaterThan(0);
        expect(frame.data.some((value) => value !== 0)).toBe(true);
        consumeData(frame.data);
      }
      return { type: "target", frame: replayFrame };
    });
    const init = jest.fn().mockResolvedValue(undefined);
    const resetForSeek = jest.fn();
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      init,
      decode,
      decodeFrames,
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue({ codec: "hvc1.1.6.L93.B0" }),
      resetForSeek,
      lastImageBitmap: undefined,
      lastVideoFrame: undefined,
    } as unknown as ImageRenderable["videoPlayer"];

    const originalCreateImageBitmap = self.createImageBitmap;
    const replayBitmap = new ImageBitmap();
    self.createImageBitmap = jest.fn().mockResolvedValue(replayBitmap);

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(h265Keyframe.slice(), { sec: 0, nsec: 0 }), 100);
    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(
      createH265Frame(h265DeltaFrame.slice(), { sec: 0, nsec: 33333333 }),
      100,
    );
    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(
      createH265Frame(h265DeltaFrame.slice(), { sec: 0, nsec: 66666666 }),
      100,
    );
    // @ts-expect-error decodeImage is protected, but ok to use on tests
    const bitmap = await renderable.decodeImage(
      createH265Frame(h265DeltaFrame.slice(), { sec: 0, nsec: 33333333 }),
      100,
    );

    expect(bitmap).toBe(replayBitmap);
    expect(resetForSeek).toHaveBeenCalled();
    expect(init).toHaveBeenCalledWith({ codec: "hvc1.1.6.L93.B0" });
    expect(decodeFrames).toHaveBeenCalledWith([
      { data: expect.any(Uint8Array), timestampMicros: 0, type: "key" },
      { data: expect.any(Uint8Array), timestampMicros: 33333, type: "delta" },
    ]);

    self.createImageBitmap = originalCreateImageBitmap;
  });

  it("should wait for a new h265 keyframe after a decode error", async () => {
    const renderable = new ImageRenderable(mockUserData.topic, mockRenderer, { ...mockUserData });
    const init = jest.fn().mockResolvedValue(undefined);
    const decode = jest
      .fn<Promise<VideoFrame | undefined>, [Uint8Array, number, "key" | "delta"]>()
      .mockResolvedValueOnce(createDecodedVideoFrame(0))
      .mockResolvedValueOnce(createDecodedVideoFrame(33333))
      .mockResolvedValueOnce(createDecodedVideoFrame(66666));
    const resetForSeek = jest.fn(() => {
      if (renderable.videoPlayer) {
        renderable.videoPlayer.lastImageBitmap = undefined;
      }
    });
    const lastImageBitmap = new ImageBitmap();
    renderable.videoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      init,
      decode,
      codedSize: jest.fn(),
      decoderConfig: jest.fn().mockReturnValue({ codec: "hvc1.1.6.L93.B0" }),
      resetForSeek,
      lastImageBitmap,
      lastVideoFrame: undefined,
    } as unknown as ImageRenderable["videoPlayer"];

    const originalCreateImageBitmap = self.createImageBitmap;
    const createImageBitmapSpy = jest.fn().mockImplementation(async () => new ImageBitmap());
    self.createImageBitmap = createImageBitmapSpy;

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(h265Keyframe, { sec: 0, nsec: 0 }), 100);
    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(h265DeltaFrame, { sec: 0, nsec: 33333333 }), 100);

    const bitmapBeforeError = renderable.videoPlayer?.lastImageBitmap;

    // @ts-expect-error handleVideoPlayerError is protected, but ok to use on tests
    renderable.handleVideoPlayerError(new Error("Decoding error"));
    (console.error as jest.Mock).mockClear();

    // @ts-expect-error decodeImage is protected, but ok to use on tests
    const skipped = await renderable.decodeImage(
      createH265Frame(h265DeltaFrame, { sec: 0, nsec: 66666666 }),
      100,
    );
    // @ts-expect-error decodeImage is protected, but ok to use on tests
    await renderable.decodeImage(createH265Frame(h265Keyframe, { sec: 0, nsec: 83333333 }), 100);

    expect(skipped).not.toBe(bitmapBeforeError);
    expect(decode).toHaveBeenCalledTimes(3);
    expect(decode).toHaveBeenNthCalledWith(1, expect.any(Uint8Array), 0, "key");
    expect(decode).toHaveBeenNthCalledWith(2, expect.any(Uint8Array), 33333, "delta");
    expect(decode).toHaveBeenNthCalledWith(3, expect.any(Uint8Array), 83333, "key");
    expect(resetForSeek).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);

    self.createImageBitmap = originalCreateImageBitmap;
  });
});
