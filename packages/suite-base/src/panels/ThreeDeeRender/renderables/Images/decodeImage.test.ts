/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { H264, H265, VideoPlayer } from "@lichtblick/den/video";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";

import { CompressedImageTypes, CompressedVideo } from "./ImageTypes";
import {
  decodeCompressedImageToBitmap,
  isVideoKeyframe,
  getVideoDecoderConfig,
  prepareVideoFrame,
  decodeCompressedVideoToBitmap,
  decodeRawImage,
  emptyVideoFrame,
} from "./decodeImage";
import { Image as RosImage } from "../../ros";

function createMockVideoFrame(override?: Partial<CompressedVideo>): CompressedVideo {
  return {
    data: new Uint8Array([]),
    format: "h264",
    timestamp: RosTimeBuilder.time(),
    frame_id: "frame_video",
    ...override,
  };
}

describe("decodeCompressedImageToBitmap", () => {
  it("should decode a compressed image to an ImageBitmap", async () => {
    const mockImage: CompressedImageTypes = {
      data: new Uint8Array([1, 2, 3]),
      format: "jpeg",
      timestamp: RosTimeBuilder.time(),
      frame_id: "frame_1",
    };
    const bitmap = await decodeCompressedImageToBitmap(mockImage);
    expect(bitmap).toBeInstanceOf(ImageBitmap);
  });
});

describe("isVideoKeyframe", () => {
  it("should return true for a keyframe", () => {
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x65]), // Mock IDR NAL unit
    });
    jest.spyOn(H264, "IsKeyframe").mockReturnValue(true);
    expect(isVideoKeyframe(mockVideoFrame)).toBe(true);
  });

  it("should return false for a non-keyframe", () => {
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x41]), // Mock non-IDR NAL unit
    });
    jest.spyOn(H264, "IsKeyframe").mockReturnValue(false);
    expect(isVideoKeyframe(mockVideoFrame)).toBe(false);
  });

  it("should use H265 keyframe detection for h265 format", () => {
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x26]),
      format: "h265",
    });
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(true);
    expect(isVideoKeyframe(mockVideoFrame)).toBe(true);
  });
});

describe("getVideoDecoderConfig", () => {
  it("should return a VideoDecoderConfig for h264 format", () => {
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x67]), // Mock SPS NAL unit
    });
    const mockConfig = { codec: "avc1.42E01E" };
    jest.spyOn(H264, "ParseDecoderConfig").mockReturnValue(mockConfig);
    expect(getVideoDecoderConfig(mockVideoFrame)).toEqual(mockConfig);
  });

  it("should return undefined for unsupported formats", () => {
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x00]),
    });
    expect(getVideoDecoderConfig(mockVideoFrame)).toBeUndefined();
  });

  it("should return a VideoDecoderConfig for h265 format", () => {
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x00]),
      format: "h265",
    });
    const mockConfig = { codec: "hev1.1.6.L153.B0" };
    jest.spyOn(H265, "ParseDecoderConfig").mockReturnValue(mockConfig);
    expect(getVideoDecoderConfig(mockVideoFrame)).toEqual(mockConfig);
  });
});

describe("decodeCompressedVideoToBitmap", () => {
  it("should decode a compressed video frame to an ImageBitmap", async () => {
    const mockVideoFrame = createMockVideoFrame();
    const preparedFrame = {
      data: mockVideoFrame.data,
      type: "delta" as const,
    };
    const mockVideoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      decode: jest.fn().mockResolvedValue(new ImageBitmap()),
    } as unknown as VideoPlayer;
    const bitmap = await decodeCompressedVideoToBitmap(
      mockVideoFrame,
      preparedFrame,
      mockVideoPlayer,
      BigInt(0),
    );
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(mockVideoPlayer.lastImageBitmap).toBeDefined();
  });

  it("should return an empty video frame if the video player is not initialized", async () => {
    const mockVideoFrame = createMockVideoFrame();
    const preparedFrame = {
      data: mockVideoFrame.data,
      type: "delta" as const,
    };
    const mockVideoPlayer = {
      isInitialized: jest.fn().mockReturnValue(false),
      codedSize: jest.fn(),
    } as unknown as VideoPlayer;

    const bitmap = await decodeCompressedVideoToBitmap(
      mockVideoFrame,
      preparedFrame,
      mockVideoPlayer,
      BigInt(0),
    );
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(mockVideoPlayer.lastImageBitmap).toBeUndefined();
  });
});

describe("prepareVideoFrame", () => {
  it("should normalize length-prefixed h265 keyframes", () => {
    const parameterSet = [(32 << 1) | 1, 0x01];
    const keyframe = [(19 << 1) | 1, 0x01];
    const mockVideoFrame = createMockVideoFrame({
      format: "h265",
      data: new Uint8Array([
        0x00,
        0x00,
        0x00,
        parameterSet.length,
        ...parameterSet,
        0x00,
        0x00,
        0x00,
        keyframe.length,
        ...keyframe,
      ]),
    });

    const preparedFrame = prepareVideoFrame(mockVideoFrame);

    expect(preparedFrame.type).toBe("key");
    expect(preparedFrame.decoderConfig).toEqual({ codec: "hev1.1.6.L153.B0" });
    expect(preparedFrame.data).toEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x01, ...parameterSet, 0x00, 0x00, 0x00, 0x01, ...keyframe]),
    );
  });

  it("should return detailed diagnostics for unsupported h265 bitstreams", () => {
    const mockVideoFrame = createMockVideoFrame({
      format: "h265",
      data: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    });

    const preparedFrame = prepareVideoFrame(mockVideoFrame);

    expect(preparedFrame.type).toBe("delta");
    expect(preparedFrame.decoderConfig).toBeUndefined();
    expect(preparedFrame.diagnostics).toBe("unsupported H.265 bitstream format");
  });
});

describe("decodeRawImage", () => {
  function createMockROSImage(override?: Partial<RosImage>): RosImage {
    return {
      encoding: "rgb8",
      width: 2,
      height: 2,
      step: 6,
      data: new Uint8Array([]),
      header: {
        frame_id: "",
        stamp: {
          sec: 0,
          nsec: 0,
        },
        seq: undefined,
      },
      is_bigendian: false,
      ...override,
    };
  }

  it.each([
    ["yuv422", 10],
    ["uyvy", 10],
    ["yuv422_yuy2", 10],
    ["yuyv", 10],
    ["rgb8", 6],
    ["rgba8", 8],
    ["bgra8", 8],
    ["bgr8", 6],
    ["8UC3", 6],
    ["32FC1", 8],
    ["bayer_rggb8", 8],
    ["bayer_bggr8", 8],
    ["bayer_gbrg8", 8],
    ["bayer_grbg8", 8],
    ["mono8", 6],
    ["8UC1", 6],
  ])("should not throw for supported encoding: %s", (encoding, step) => {
    expect(() => {
      const mockImage = createMockROSImage({
        step,
        encoding,
        data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0]),
      });
      const output = new Uint8ClampedArray(12);
      decodeRawImage(mockImage, {}, output);
    }).not.toThrow();
  });

  it("should throw an error for unsupported encoding", () => {
    const mockImage = createMockROSImage({
      encoding: "unsupported",
    });
    const output = new Uint8ClampedArray(12);
    expect(() => {
      decodeRawImage(mockImage, {}, output);
    }).toThrow("Unsupported encoding unsupported");
  });

  it.each([
    ["yuv422", 10],
    ["uyvy", 10],
    ["yuv422_yuy2", 10],
    ["yuyv", 10],
    ["rgb8", 6],
    ["rgba8", 8],
    ["bgra8", 8],
    ["bgr8", 6],
    ["8UC3", 6],
    ["32FC1", 8],
    ["bayer_rggb8", 8],
    ["bayer_bggr8", 8],
    ["bayer_gbrg8", 8],
    ["bayer_grbg8", 8],
    ["mono8", 6],
    ["8UC1", 6],
  ])("should not throw for supported encoding: %s", (encoding, step) => {
    expect(() => {
      const mockImage = createMockROSImage({
        step,
        encoding,
        data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0]),
      });
      const output = new Uint8ClampedArray(12);
      decodeRawImage(mockImage, {}, output);
    }).not.toThrow();
  });
});

describe("emptyVideoFrame", () => {
  it("should return an empty ImageBitmap", async () => {
    const bitmap = await emptyVideoFrame();
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(bitmap.width).toEqual(32); // default 32x32
    expect(bitmap.height).toEqual(32); // default 32x32
  });

  it("should return an empty ImageBitmap with specified resizeWidth", async () => {
    const bitmap = await emptyVideoFrame(undefined, 100);
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(bitmap.width).toEqual(100);
    expect(bitmap.height).toEqual(100);
  });
});
