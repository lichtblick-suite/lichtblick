// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import GrayscalePngBuilder from "@lichtblick/suite-base/testing/builders/GrayscalePngBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";

import { CompressedImageTypes } from "./ImageTypes";
import {
  decodeCompressedDepthToRawImage,
  parseCompressedDepthFormat,
} from "./decodeCompressedDepth";

const WIDTH = 3;
const HEIGHT = 2;
const QUANTIZED = [0, 1000, 2500, 40000, 65535, 12345];

/** Builds the 12 byte ConfigHeader that precedes the PNG payload. */
function configHeader(depthQuantA: number, depthQuantB: number): Uint8Array {
  const header = new Uint8Array(12);
  const view = new DataView(header.buffer);
  view.setInt32(0, 0, true); // compressionFormat INV_DEPTH
  view.setFloat32(4, depthQuantA, true);
  view.setFloat32(8, depthQuantB, true);
  return header;
}

async function buildDepthImage({
  format,
  depthQuantA = 0,
  depthQuantB = 0,
  samples = QUANTIZED,
  bitDepth = 16,
}: {
  format: string;
  depthQuantA?: number;
  depthQuantB?: number;
  samples?: number[];
  bitDepth?: 8 | 16;
}): Promise<CompressedImageTypes> {
  const png = await GrayscalePngBuilder.png(WIDTH, HEIGHT, bitDepth, samples);
  const header = configHeader(depthQuantA, depthQuantB);
  const data = new Uint8Array(header.length + png.length);
  data.set(header);
  data.set(png, header.length);
  return { data, format, timestamp: RosTimeBuilder.time(), frame_id: "depth_frame" };
}

describe("parseCompressedDepthFormat", () => {
  it.each([
    ["16UC1; compressedDepth png", { encoding: "16UC1", codec: "png" }],
    ["32FC1; compressedDepth png", { encoding: "32FC1", codec: "png" }],
    ["16UC1; compressedDepth rvl", { encoding: "16UC1", codec: "rvl" }],
    // Publishers predating the RVL support omit the codec entirely.
    ["16UC1; compressedDepth", { encoding: "16UC1", codec: "" }],
  ])("should parse %s", (format, expected) => {
    expect(parseCompressedDepthFormat(format)).toEqual(expected);
  });

  it.each([
    // Regular compressed image transport, which the browser can decode directly.
    "bgr8; jpeg compressed bgr8",
    "rgb8; png compressed bgr8",
    "jpeg",
    "png",
    "h264",
    "",
  ])("should not treat %s as a compressedDepth image", (format) => {
    expect(parseCompressedDepthFormat(format)).toBeUndefined();
  });
});

describe("decodeCompressedDepthToRawImage", () => {
  it("should decode a 16UC1 image into raw little-endian millimetres", async () => {
    // GIVEN a 16UC1 compressedDepth image
    const image = await buildDepthImage({ format: "16UC1; compressedDepth png" });

    // WHEN it is decoded
    const result = await decodeCompressedDepthToRawImage(image, {
      encoding: "16UC1",
      codec: "png",
    });

    // THEN it becomes a raw 16UC1 image carrying the untouched depth samples
    expect(result.encoding).toBe("16UC1");
    expect(result.width).toBe(WIDTH);
    expect(result.height).toBe(HEIGHT);
    expect(result.step).toBe(WIDTH * 2);
    expect(result.frame_id).toBe("depth_frame");
    // The raw image decoders read native little-endian samples.
    const view = new DataView(result.data.buffer, result.data.byteOffset, result.data.byteLength);
    expect(QUANTIZED.map((_, i) => view.getUint16(i * 2, true))).toEqual(QUANTIZED);
  });

  it("should undo the inverse depth quantization of a 32FC1 image", async () => {
    // GIVEN a 32FC1 compressedDepth image with quantization parameters
    const depthQuantA = 1000;
    const depthQuantB = 2;
    const image = await buildDepthImage({
      format: "32FC1; compressedDepth png",
      depthQuantA,
      depthQuantB,
    });

    // WHEN it is decoded
    const result = await decodeCompressedDepthToRawImage(image, {
      encoding: "32FC1",
      codec: "png",
    });

    // THEN the quantized samples are converted back to metres
    expect(result.encoding).toBe("32FC1");
    expect(result.step).toBe(WIDTH * 4);
    const depths = new Float32Array(
      result.data.buffer,
      result.data.byteOffset,
      WIDTH * HEIGHT,
    );
    // A zero sample marks a pixel the publisher could not measure.
    expect(depths[0]).toBeNaN();
    for (let i = 1; i < QUANTIZED.length; i++) {
      expect(depths[i]).toBeCloseTo(depthQuantA / (QUANTIZED[i]! - depthQuantB), 4);
    }
  });

  it("should reject the RVL codec", async () => {
    // GIVEN an RVL encoded depth image
    const image = await buildDepthImage({ format: "16UC1; compressedDepth rvl" });

    // WHEN it is decoded THEN it is rejected with a codec specific message
    await expect(
      decodeCompressedDepthToRawImage(image, { encoding: "16UC1", codec: "rvl" }),
    ).rejects.toThrow('Unsupported compressedDepth codec "rvl"');
  });

  it("should reject an unknown depth encoding", async () => {
    // GIVEN a depth image claiming an encoding that is not a depth encoding
    const image = await buildDepthImage({ format: "8UC1; compressedDepth png" });

    // WHEN it is decoded THEN it is rejected
    await expect(
      decodeCompressedDepthToRawImage(image, { encoding: "8UC1", codec: "png" }),
    ).rejects.toThrow('Unsupported compressedDepth encoding "8UC1"');
  });

  it("should reject a payload that is only a header", async () => {
    // GIVEN a message with no PNG after the ConfigHeader
    const image: CompressedImageTypes = {
      data: configHeader(0, 0),
      format: "16UC1; compressedDepth png",
      timestamp: RosTimeBuilder.time(),
      frame_id: "depth_frame",
    };

    // WHEN it is decoded THEN it is rejected
    await expect(
      decodeCompressedDepthToRawImage(image, { encoding: "16UC1", codec: "png" }),
    ).rejects.toThrow("missing its payload");
  });

  it("should reject a payload that is not 16 bit", async () => {
    // GIVEN a depth image whose PNG carries 8 bit samples
    const image = await buildDepthImage({
      format: "16UC1; compressedDepth png",
      bitDepth: 8,
      samples: [0, 1, 2, 3, 4, 5],
    });

    // WHEN it is decoded THEN it is rejected
    await expect(
      decodeCompressedDepthToRawImage(image, { encoding: "16UC1", codec: "png" }),
    ).rejects.toThrow("expected 16");
  });
});
