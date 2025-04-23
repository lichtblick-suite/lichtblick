/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { H264, VideoPlayer } from "@lichtblick/den/video";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";

import { CompressedImageTypes, CompressedVideo } from "./ImageTypes";
import {
  decodeCompressedImageToBitmap,
  isVideoKeyframe,
  getVideoDecoderConfig,
  decodeCompressedVideoToBitmap,
  decodeRawImage,
  emptyVideoFrame,
} from "./decodeImage";
import { Image as RosImage } from "../../ros";

function createMockVideoFrame(override: Partial<CompressedVideo>): CompressedVideo {
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
});

describe("decodeCompressedVideoToBitmap", () => {
  it("should decode a compressed video frame to an ImageBitmap", async () => {
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([1, 2, 3]),
    });
    const mockVideoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      decode: jest.fn().mockResolvedValue(new ImageBitmap()),
    } as unknown as VideoPlayer;
    const bitmap = await decodeCompressedVideoToBitmap(mockVideoFrame, mockVideoPlayer, BigInt(0));
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(mockVideoPlayer.lastImageBitmap).toBeDefined();
  });

  it("should return an empty video frame if the video player is not initialized", async () => {
    const mockFrame: CompressedVideo = {
      data: new Uint8Array([1, 2, 3]),
      format: "h264",
      timestamp: RosTimeBuilder.time(),
      frame_id: "frame__video",
    };
    const mockVideoPlayer = {
      isInitialized: jest.fn().mockReturnValue(false),
      codedSize: jest.fn(),
    } as unknown as VideoPlayer;

    const bitmap = await decodeCompressedVideoToBitmap(mockFrame, mockVideoPlayer, BigInt(0));
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(mockVideoPlayer.lastImageBitmap).toBeUndefined();
  });
});

describe("decodeRawImage", () => {
  it("should decode a raw image with rgb8 encoding", () => {
    const mockImage: RosImage = {
      encoding: "rgb8",
      width: 2,
      height: 2,
      step: 6,
      data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]),
      header: {
        frame_id: "",
        stamp: {
          sec: 0,
          nsec: 0,
        },
        seq: undefined,
      },
      is_bigendian: false,
    };
    const output = new Uint8ClampedArray(12);
    decodeRawImage(mockImage, {}, output);
    expect(output).toEqual(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]));
  });

  it("should throw an error for unsupported encoding", () => {
    const mockImage: RosImage = {
      encoding: "unsupported",
      width: 2,
      height: 2,
      step: 6,
      data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]),
      header: {
        frame_id: "",
        stamp: {
          sec: 0,
          nsec: 0,
        },
        seq: undefined,
      },
      is_bigendian: false,
    };
    const output = new Uint8ClampedArray(12);
    expect(() => {
      decodeRawImage(mockImage, {}, output);
    }).toThrow("Unsupported encoding unsupported");
  });
});

describe("emptyVideoFrame", () => {
  it("should return an empty ImageBitmap", async () => {
    const bitmap = await emptyVideoFrame();
    expect(bitmap).toBeInstanceOf(ImageBitmap);
  });
});
