/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  H264 as H264Parser,
  H265 as H265Parser,
  H265NaluType,
  H265SliceType,
  VideoPlayer,
} from "@lichtblick/den/video";
import H265FrameBuilder from "@lichtblick/suite-base/testing/builders/H265FrameBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";

import { CompressedImageTypes, CompressedVideo } from "./ImageTypes";
import {
  decodeCompressedImageToBitmap,
  isCompressedVideoKeyframe,
  getVideoDecoderConfig,
  prepareVideoFrame,
  decodeCompressedVideoToBitmap,
  decodeRawImage,
  emptyVideoFrame,
} from "./decodeImage";
import { PreparedVideoFrameStatus } from "./types";
import { Image as RosImage } from "../../ros";

afterEach(() => {
  jest.restoreAllMocks();
});

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
    // GIVEN a compressed JPEG image
    const mockImage: CompressedImageTypes = {
      data: new Uint8Array([1, 2, 3]),
      format: "jpeg",
      timestamp: RosTimeBuilder.time(),
      frame_id: "frame_1",
    };

    // WHEN it is decoded to a bitmap
    const bitmap = await decodeCompressedImageToBitmap(mockImage);

    // THEN an ImageBitmap is produced
    expect(bitmap).toBeInstanceOf(ImageBitmap);
  });
});

describe("isCompressedVideoKeyframe", () => {
  it("should return true for a keyframe", () => {
    // GIVEN an H.264 frame that the parser reports as a keyframe
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x65]), // Mock IDR NAL unit
    });
    jest.spyOn(H264Parser, "IsKeyframe").mockReturnValue(true);

    // WHEN keyframe detection runs
    // THEN it reports a keyframe
    expect(isCompressedVideoKeyframe(mockVideoFrame)).toBe(true);
  });

  it("should return false for a non-keyframe", () => {
    // GIVEN an H.264 frame that the parser reports as a non-keyframe
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x41]), // Mock non-IDR NAL unit
    });
    jest.spyOn(H264Parser, "IsKeyframe").mockReturnValue(false);

    // WHEN keyframe detection runs
    // THEN it reports a non-keyframe
    expect(isCompressedVideoKeyframe(mockVideoFrame)).toBe(false);
  });

  it("should use H265 keyframe detection for h265 format", () => {
    // GIVEN an H.265 frame that the H.265 parser reports as a keyframe
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x26]),
      format: "h265",
    });
    jest.spyOn(H265Parser, "IsKeyframe").mockReturnValue(true);

    // WHEN keyframe detection runs
    // THEN the H.265 parser is used and reports a keyframe
    expect(isCompressedVideoKeyframe(mockVideoFrame)).toBe(true);
  });
});

describe("getVideoDecoderConfig", () => {
  it("should return a VideoDecoderConfig for h264 format", () => {
    // GIVEN an H.264 frame and a stubbed decoder config
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x67]), // Mock SPS NAL unit
    });
    const mockConfig = { codec: "avc1.42E01E" };
    jest.spyOn(H264Parser, "ParseDecoderConfig").mockReturnValue(mockConfig);

    // WHEN the decoder config is requested
    // THEN the H.264 parser config is returned
    expect(getVideoDecoderConfig(mockVideoFrame)).toEqual(mockConfig);
  });

  it("should return undefined for unsupported formats", () => {
    // GIVEN a frame with an unsupported format
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x00]),
      format: "unsupported",
    });

    // WHEN the decoder config is requested
    // THEN no config is available
    expect(getVideoDecoderConfig(mockVideoFrame)).toBeUndefined();
  });

  it("should return a VideoDecoderConfig for h265 format", () => {
    // GIVEN an H.265 frame and a stubbed decoder config
    const mockVideoFrame = createMockVideoFrame({
      data: new Uint8Array([0x00]),
      format: "h265",
    });
    const mockConfig = { codec: "hvc1.1.6.L93.B0" };
    jest.spyOn(H265Parser, "ParseDecoderConfig").mockReturnValue(mockConfig);

    // WHEN the decoder config is requested
    // THEN the H.265 parser config is returned
    expect(getVideoDecoderConfig(mockVideoFrame)).toEqual(mockConfig);
  });
});

describe("decodeCompressedVideoToBitmap", () => {
  it("should decode a compressed video frame to an ImageBitmap", async () => {
    // GIVEN an initialized video player and a prepared delta frame
    const mockVideoFrame = createMockVideoFrame();
    const preparedFrame = {
      data: mockVideoFrame.data,
      type: "delta" as const,
      status: PreparedVideoFrameStatus.Ok,
    };
    const mockVideoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      decode: jest.fn().mockResolvedValue(new ImageBitmap()),
    } as unknown as VideoPlayer;

    // WHEN the frame is decoded to a bitmap
    const bitmap = await decodeCompressedVideoToBitmap(
      mockVideoFrame,
      preparedFrame,
      mockVideoPlayer,
      BigInt(0),
    );

    // THEN an ImageBitmap is produced and cached as the last image bitmap
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(mockVideoPlayer.lastImageBitmap).toBeDefined();
  });

  it("should use integer microsecond timestamps for video decode", async () => {
    // GIVEN a frame at 1500ns and a first-message time of 1000ns
    const mockVideoFrame = createMockVideoFrame({
      timestamp: { sec: 0, nsec: 1500 },
    });
    const preparedFrame = {
      data: mockVideoFrame.data,
      type: "delta" as const,
      status: PreparedVideoFrameStatus.Ok,
    };
    const decode = jest.fn().mockResolvedValue(new ImageBitmap());
    const mockVideoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      decode,
    } as unknown as VideoPlayer;

    // WHEN the frame is decoded
    await decodeCompressedVideoToBitmap(mockVideoFrame, preparedFrame, mockVideoPlayer, 1000n);

    // THEN decode receives the elapsed time truncated to whole microseconds
    expect(decode).toHaveBeenCalledWith(mockVideoFrame.data, 0, "delta");
  });

  it("should return an empty video frame if the video player is not initialized", async () => {
    // GIVEN an uninitialized video player and a prepared delta frame
    const mockVideoFrame = createMockVideoFrame();
    const preparedFrame = {
      data: mockVideoFrame.data,
      type: "delta" as const,
      status: PreparedVideoFrameStatus.Ok,
    };
    const mockVideoPlayer = {
      isInitialized: jest.fn().mockReturnValue(false),
      codedSize: jest.fn(),
    } as unknown as VideoPlayer;

    // WHEN the frame is decoded
    const bitmap = await decodeCompressedVideoToBitmap(
      mockVideoFrame,
      preparedFrame,
      mockVideoPlayer,
      BigInt(0),
    );

    // THEN an empty placeholder bitmap is returned and nothing is cached
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(mockVideoPlayer.lastImageBitmap).toBeUndefined();
  });

  it("should reuse the last decoded frame when decode returns undefined", async () => {
    // GIVEN an initialized player whose decode yields no new frame but has a last frame
    const mockVideoFrame = createMockVideoFrame();
    const lastVideoFrame = {
      codedWidth: 2,
      codedHeight: 2,
      timestamp: 10,
      close: jest.fn(),
    } as unknown as VideoFrame;
    const originalCreateImageBitmap = self.createImageBitmap;
    const createImageBitmapSpy = jest.fn().mockResolvedValue(new ImageBitmap());
    self.createImageBitmap = createImageBitmapSpy;
    const preparedFrame = {
      data: mockVideoFrame.data,
      type: "delta" as const,
      status: PreparedVideoFrameStatus.Ok,
    };
    const mockVideoPlayer = {
      isInitialized: jest.fn().mockReturnValue(true),
      decode: jest.fn().mockResolvedValue(undefined),
      lastVideoFrame,
    } as unknown as VideoPlayer;

    // WHEN the frame is decoded
    const bitmap = await decodeCompressedVideoToBitmap(
      mockVideoFrame,
      preparedFrame,
      mockVideoPlayer,
      BigInt(0),
    );

    // THEN the last video frame is reused to build the returned bitmap
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(mockVideoPlayer.lastImageBitmap).toBeDefined();
    expect(createImageBitmapSpy).toHaveBeenCalledWith(lastVideoFrame, { resizeWidth: undefined });
    self.createImageBitmap = originalCreateImageBitmap;
  });
});

describe("prepareVideoFrame", () => {
  it("should normalize length-prefixed h265 keyframes", () => {
    // GIVEN a length-prefixed H.265 keyframe carrying VPS/SPS/PPS parameter sets
    const data = H265FrameBuilder.lengthPrefixedKeyframeWithParameterSets();
    const mockVideoFrame = createMockVideoFrame({ format: "h265", data });

    // WHEN the frame is prepared for decoding
    const preparedFrame = prepareVideoFrame(mockVideoFrame);

    // THEN it is a keyframe normalized to Annex B with a decoder config derived from the SPS
    expect(preparedFrame.type).toBe("key");
    expect(preparedFrame.decoderConfig).toEqual({ codec: "hvc1.1.6.L93.B0" });
    expect(preparedFrame.data).toEqual(H265FrameBuilder.keyframeWithParameterSets());
    // The builder's stub SPS cannot be fully parsed, so the decoder config falls back to the
    // generic HEVC codec string.
  });

  it("should strip parameter sets from h265 delta frames", () => {
    // GIVEN a delta frame containing VPS/SPS/PPS parameter sets followed by a P-slice
    const data = H265FrameBuilder.frameData([
      H265FrameBuilder.annexBNalu(H265NaluType.VPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.SPS_NUT),
      H265FrameBuilder.annexBNalu(H265NaluType.PPS_NUT, [0xc0]),
      H265FrameBuilder.slice(1, H265SliceType.P),
    ]);
    const mockVideoFrame = createMockVideoFrame({ format: "h265", data });

    // WHEN the frame is prepared for decoding
    const preparedFrame = prepareVideoFrame(mockVideoFrame);

    // THEN it is a delta frame whose parameter sets have been stripped, leaving only the slice
    expect(preparedFrame.type).toBe("delta");
    expect(preparedFrame.data).toEqual(new Uint8Array(H265FrameBuilder.slice(1, H265SliceType.P)));
  });

  it("should return detailed diagnostics for unsupported h265 bitstreams", () => {
    // GIVEN a buffer that is neither Annex B nor length-prefixed
    const mockVideoFrame = createMockVideoFrame({
      format: "h265",
      data: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    });

    // WHEN the frame is prepared for decoding
    const preparedFrame = prepareVideoFrame(mockVideoFrame);

    // THEN it is reported as an unsupported delta frame with no decoder config
    expect(preparedFrame.type).toBe("delta");
    expect(preparedFrame.decoderConfig).toBeUndefined();
    expect(preparedFrame.diagnostics).toBe("unsupported H.265 bitstream format");
  });

  it("should skip unsupported h265 B frames", () => {
    // GIVEN an H.265 delta frame whose slice header carries a B slice_type
    const mockVideoFrame = createMockVideoFrame({
      format: "h265",
      data: H265FrameBuilder.deltaFrameWithPps(H265SliceType.B),
    });

    // WHEN the frame is prepared for decoding
    const preparedFrame = prepareVideoFrame(mockVideoFrame);

    // THEN it is flagged as an unsupported B frame with diagnostics and no decoder config
    expect(preparedFrame.type).toBe("delta");
    expect(preparedFrame.decoderConfig).toBeUndefined();
    expect(preparedFrame.status).toBe(PreparedVideoFrameStatus.UnsupportedBFrame);
    expect(preparedFrame.diagnostics).toBe("H.265 B frames are not supported");
  });

  it("should pass through h264 keyframes with decoder config", () => {
    // GIVEN an H.264 keyframe and a stubbed decoder config
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x65]);
    const decoderConfig = { codec: "avc1.42E01E" } as VideoDecoderConfig;
    const mockVideoFrame = createMockVideoFrame({ format: "h264", data });
    jest.spyOn(H264Parser, "ParseDecoderConfig").mockReturnValue(decoderConfig);
    jest.spyOn(H264Parser, "IsKeyframe").mockReturnValue(true);

    // WHEN the frame is prepared for decoding
    const preparedFrame = prepareVideoFrame(mockVideoFrame);

    // THEN the original bytes pass through unchanged with the H.264 decoder config
    expect(preparedFrame.data).toBe(data);
    expect(preparedFrame.decoderConfig).toBe(decoderConfig);
    expect(preparedFrame.type).toBe("key");
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
    // GIVEN a raw ROS image with a supported encoding and matching row step
    // WHEN it is decoded into an output buffer
    // THEN decoding completes without throwing
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
    // GIVEN a raw ROS image with an unsupported encoding
    const mockImage = createMockROSImage({
      encoding: "unsupported",
    });
    const output = new Uint8ClampedArray(12);

    // WHEN it is decoded
    // THEN decoding throws an unsupported-encoding error
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
    // GIVEN a raw ROS image with a supported encoding and matching row step
    // WHEN it is decoded into an output buffer
    // THEN decoding completes without throwing
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
    // GIVEN no explicit size
    // WHEN an empty video frame is requested
    const bitmap = await emptyVideoFrame();

    // THEN a 32x32 placeholder ImageBitmap is returned
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(bitmap.width).toEqual(32); // default 32x32
    expect(bitmap.height).toEqual(32); // default 32x32
  });

  it("should return an empty ImageBitmap with specified resizeWidth", async () => {
    // GIVEN an explicit resize width of 100
    // WHEN an empty video frame is requested
    const bitmap = await emptyVideoFrame(undefined, 100);

    // THEN a 100x100 placeholder ImageBitmap is returned
    expect(bitmap).toBeInstanceOf(ImageBitmap);
    expect(bitmap.width).toEqual(100);
    expect(bitmap.height).toEqual(100);
  });
});
