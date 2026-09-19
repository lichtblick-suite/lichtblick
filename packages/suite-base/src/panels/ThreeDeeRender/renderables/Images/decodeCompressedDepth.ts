// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RawImage } from "@foxglove/schemas";

import { CompressedImageTypes, getFrameIdFromImage, getTimestampFromImage } from "./ImageTypes";
import { decodeGrayscalePng } from "./decodeGrayscalePng";

/**
 * Support for the `compressed_depth_image_transport` format, which publishes depth images as
 * `sensor_msgs/CompressedImage` with a `format` such as `"16UC1; compressedDepth png"`.
 *
 * The payload is a 12 byte `ConfigHeader` followed by a single channel PNG. These are not browser
 * decodable media types, so they have to be turned back into the raw image they encode.
 *
 * https://github.com/ros-perception/image_transport_plugins/blob/noetic-devel/compressed_depth_image_transport/src/codec.cpp
 */

/** sizeof(ConfigHeader): an int format enum plus two float32 quantization parameters. */
const CONFIG_HEADER_SIZE = 12;

const COMPRESSED_DEPTH_TOKEN = "compresseddepth";

export type CompressedDepthFormat = {
  /** Encoding of the image before it was compressed, e.g. `"16UC1"` or `"32FC1"`. */
  encoding: string;
  /** Codec of the payload. Empty when the publisher did not name one, which implies PNG. */
  codec: string;
};

/**
 * Parses a `sensor_msgs/CompressedImage` format string.
 *
 * @returns the parsed parts, or undefined if this is not a `compressedDepth` image.
 */
export function parseCompressedDepthFormat(format: string): CompressedDepthFormat | undefined {
  // e.g. "16UC1; compressedDepth png", or "16UC1; compressedDepth" on older publishers.
  const separator = format.indexOf(";");
  if (separator < 0) {
    return undefined;
  }

  const transport = format.slice(separator + 1).trim();
  const [transportName, ...rest] = transport.split(/\s+/);
  if (transportName?.toLowerCase() !== COMPRESSED_DEPTH_TOKEN) {
    return undefined;
  }

  return {
    encoding: format.slice(0, separator).trim(),
    codec: rest.join(" ").toLowerCase(),
  };
}

/**
 * Decodes a `compressedDepth` image back into the raw image it encodes, so it can be rendered by
 * the regular raw image path with the panel's color mode settings applied.
 *
 * @throws if the codec or the encoded depth encoding is not supported.
 */
export async function decodeCompressedDepthToRawImage(
  image: CompressedImageTypes,
  format: CompressedDepthFormat,
): Promise<RawImage> {
  // An empty codec means PNG, which is what publishers predating the RVL support emit.
  if (format.codec !== "" && format.codec !== "png") {
    throw new Error(
      `Unsupported compressedDepth codec "${format.codec}", only png images can be decoded`,
    );
  }

  const { data } = image;
  if (data.byteLength <= CONFIG_HEADER_SIZE) {
    throw new Error("compressedDepth image is missing its payload");
  }

  const header = new DataView(data.buffer, data.byteOffset, CONFIG_HEADER_SIZE);
  const depthQuantA = header.getFloat32(4, true);
  const depthQuantB = header.getFloat32(8, true);

  const png = await decodeGrayscalePng(data.subarray(CONFIG_HEADER_SIZE));
  if (png.bitDepth !== 16) {
    throw new Error(
      `Unsupported compressedDepth image with ${png.bitDepth} bit samples, expected 16`,
    );
  }
  // PNG samples are big-endian; the raw image decoders read native little-endian data.
  const quantized = readBigEndianUint16(png.data, png.width * png.height);

  const base = {
    timestamp: getTimestampFromImage(image),
    frame_id: getFrameIdFromImage(image),
    width: png.width,
    height: png.height,
  };

  switch (format.encoding) {
    case "16UC1":
      // Depth is stored directly, in millimetres.
      return {
        ...base,
        encoding: "16UC1",
        step: png.width * 2,
        data: new Uint8Array(quantized.buffer, quantized.byteOffset, quantized.byteLength),
      };
    case "32FC1": {
      // The publisher quantized inverse depth into the 16 bit samples, undo that to get metres.
      const depths = new Float32Array(quantized.length);
      for (let i = 0; i < quantized.length; i++) {
        const value = quantized[i]!;
        // Zero marks a pixel the publisher could not measure.
        depths[i] = value === 0 ? NaN : depthQuantA / (value - depthQuantB);
      }
      return {
        ...base,
        encoding: "32FC1",
        step: png.width * 4,
        data: new Uint8Array(depths.buffer),
      };
    }
    default:
      throw new Error(
        `Unsupported compressedDepth encoding "${format.encoding}", expected 16UC1 or 32FC1`,
      );
  }
}

function readBigEndianUint16(data: Uint8Array, sampleCount: number): Uint16Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const samples = new Uint16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = view.getUint16(i * 2, false);
  }
  return samples;
}
