// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RawImage } from "@foxglove/schemas";
import * as _ from "lodash-es";

import {
  decodeBGR8,
  decodeBGRA8,
  decodeBayerBGGR8,
  decodeBayerGBRG8,
  decodeBayerGRBG8,
  decodeBayerRGGB8,
  decodeFloat1c,
  decodeMono16,
  decodeMono8,
  decodeRGB8,
  decodeRGBA8,
  decodeUYVY,
  decodeYUYV,
} from "@lichtblick/den/image";
import {
  H264 as H264Parser,
  H265 as H265Parser,
  VideoCodec,
  VideoPlayer,
  canonicalVideoCodec,
  isVideoKeyframe,
} from "@lichtblick/den/video";
import { toNanoSec } from "@lichtblick/rostime";

import { CompressedImageTypes, CompressedVideo } from "./ImageTypes";
import { PreparedVideoFrame, PreparedVideoFrameStatus, PrepareVideoFrameContext } from "./types";
import { Image as RosImage } from "../../ros";
import { ColorModeSettings, getColorConverter } from "../colorMode";

// Codec normalization (`VideoCodec`, `canonicalVideoCodec`, `isVideoKeyframe`) lives in
// `@lichtblick/den/video` so both the renderer and the player-side seek backfill share a single
// source of truth.

export async function decodeCompressedImageToBitmap(
  image: CompressedImageTypes,
  resizeWidth?: number,
): Promise<ImageBitmap> {
  const bitmapData = new Blob([new Uint8Array(image.data)], { type: `image/${image.format}` });
  return await createImageBitmap(bitmapData, { resizeWidth });
}

export function isCompressedVideoKeyframe(frameMsg: CompressedVideo): boolean {
  return isVideoKeyframe(frameMsg.format, frameMsg.data);
}

export function getVideoDecoderConfig(frameMsg: CompressedVideo): VideoDecoderConfig | undefined {
  switch (canonicalVideoCodec(frameMsg.format)) {
    case VideoCodec.H264:
      // Search for an SPS NAL unit to initialize the decoder. This should precede each keyframe.
      return H264Parser.ParseDecoderConfig(frameMsg.data);
    case VideoCodec.H265:
      // For now this returns a default H.265 codec config (codec string only); profile/level/tier
      // are not derived from the SPS yet. A future SPS parser will fill in those fields here.
      return H265Parser.ParseDecoderConfig(frameMsg.data);
  }
  return undefined;
}

export function prepareVideoFrame(
  frameMsg: CompressedVideo,
  context?: PrepareVideoFrameContext,
): PreparedVideoFrame {
  switch (canonicalVideoCodec(frameMsg.format)) {
    case VideoCodec.H265: {
      const frameInfo = H265Parser.InspectFrame(frameMsg.data, context?.h265);
      if (frameInfo.bitstreamFormat === "unknown" || frameInfo.normalizedData == undefined) {
        return {
          data: frameMsg.data,
          status: PreparedVideoFrameStatus.UnsupportedBitstream,
          diagnostics: "unsupported H.265 bitstream format",
          type: "delta",
        };
      }
      if (frameInfo.frameType === "B") {
        return {
          data: frameInfo.normalizedData,
          status: PreparedVideoFrameStatus.UnsupportedBFrame,
          diagnostics: "H.265 B frames are not supported",
          type: "delta",
        };
      }

      const type = frameInfo.isKeyframe ? "key" : "delta";
      return {
        data:
          type === "key"
            ? frameInfo.normalizedData
            : (H265Parser.StripParameterSets(frameInfo.normalizedData) ?? frameInfo.normalizedData),
        decoderConfig: H265Parser.ParseDecoderConfig(frameInfo.normalizedData),
        status: PreparedVideoFrameStatus.Ok,
        type,
      };
    }
    case VideoCodec.H264:
    default:
      return {
        data: frameMsg.data,
        decoderConfig: getVideoDecoderConfig(frameMsg),
        status: PreparedVideoFrameStatus.Ok,
        type: isCompressedVideoKeyframe(frameMsg) ? "key" : "delta",
      };
  }
}

export async function decodeCompressedVideoToBitmap(
  frameMsg: Pick<CompressedVideo, "timestamp">,
  preparedFrame: PreparedVideoFrame,
  videoPlayer: VideoPlayer,
  firstMessageTime: bigint,
  resizeWidth?: number,
): Promise<ImageBitmap> {
  if (!videoPlayer.isInitialized()) {
    return await emptyVideoFrame(videoPlayer, resizeWidth);
  }

  // Match Foxglove/WebCodecs behavior by using integer microseconds relative to the first frame.
  const timestampMicros = Number((toNanoSec(frameMsg.timestamp) - firstMessageTime) / 1000n);

  const videoFrame = await videoPlayer.decode(
    preparedFrame.data,
    timestampMicros,
    preparedFrame.type,
  );
  try {
    const frameToRender = videoFrame ?? videoPlayer.lastVideoFrame;
    if (!frameToRender) {
      return videoPlayer.lastImageBitmap ?? (await emptyVideoFrame(videoPlayer, resizeWidth));
    }
    // Skip re-encoding the same frame when the decoder produced nothing new.
    if (!videoFrame && videoPlayer.lastImageBitmap) {
      return videoPlayer.lastImageBitmap;
    }
    const imageBitmap = await globalThis.createImageBitmap(frameToRender, { resizeWidth });
    videoPlayer.lastImageBitmap?.close();
    videoPlayer.lastImageBitmap = imageBitmap;
    return imageBitmap;
  } finally {
    videoFrame?.close();
  }
}

export const IMAGE_DEFAULT_COLOR_MODE_SETTINGS: Required<
  Omit<ColorModeSettings, "colorField" | "minValue" | "maxValue">
> = {
  colorMode: "gradient",
  flatColor: "#ffffff",
  gradient: ["#000000", "#ffffff"],
  colorMap: "turbo",
  explicitAlpha: 0,
};
const MIN_MAX_16_BIT = { minValue: 0, maxValue: 65535 };

export type RawImageOptions = ColorModeSettings;

/**
 * See also:
 * https://github.com/ros2/common_interfaces/blob/366eea24ffce6c87f8860cbcd27f4863f46ad822/sensor_msgs/include/sensor_msgs/image_encodings.hpp
 */
export function decodeRawImage(
  image: RosImage | RawImage,
  options: Partial<RawImageOptions>,
  output: Uint8ClampedArray,
): void {
  const { encoding, width, height, step } = image;
  const is_bigendian = "is_bigendian" in image ? image.is_bigendian : false;
  const rawData = image.data as Uint8Array;
  switch (encoding) {
    case "yuv422":
    case "uyvy":
      decodeUYVY(rawData, width, height, step, output);
      break;
    case "yuv422_yuy2":
    case "yuyv":
      decodeYUYV(rawData, width, height, step, output);
      break;
    case "rgb8":
      decodeRGB8(rawData, width, height, step, output);
      break;
    case "rgba8":
      decodeRGBA8(rawData, width, height, step, output);
      break;
    case "bgra8":
      decodeBGRA8(rawData, width, height, step, output);
      break;
    case "bgr8":
    case "8UC3":
      decodeBGR8(rawData, width, height, step, output);
      break;
    case "32FC1":
      decodeFloat1c(rawData, width, height, step, is_bigendian, output);
      break;
    case "bayer_rggb8":
      decodeBayerRGGB8(rawData, width, height, step, output);
      break;
    case "bayer_bggr8":
      decodeBayerBGGR8(rawData, width, height, step, output);
      break;
    case "bayer_gbrg8":
      decodeBayerGBRG8(rawData, width, height, step, output);
      break;
    case "bayer_grbg8":
      decodeBayerGRBG8(rawData, width, height, step, output);
      break;
    case "mono8":
    case "8UC1":
      decodeMono8(rawData, width, height, step, output);
      break;
    case "mono16":
    case "16UC1": {
      // combine options with defaults. lodash merge makes sure undefined values in options are replaced with defaults
      // whereas a normal spread would allow undefined values to overwrite defaults
      const settings = _.merge({}, IMAGE_DEFAULT_COLOR_MODE_SETTINGS, MIN_MAX_16_BIT, options);
      if (settings.colorMode === "rgba-fields" || settings.colorMode === "flat") {
        throw Error(`${settings.colorMode} color mode is not supported for mono16 images`);
      }
      const min = settings.minValue;
      const max = settings.maxValue;
      const tempColor = { r: 0, g: 0, b: 0, a: 0 };
      const converter = getColorConverter(
        settings as ColorModeSettings & {
          colorMode: typeof settings.colorMode;
        },
        min,
        max,
      );
      decodeMono16(rawData, width, height, step, is_bigendian, output, {
        minValue: options.minValue,
        maxValue: options.maxValue,
        colorConverter: (value: number) => {
          converter(tempColor, value);
          return tempColor;
        },
      });
      break;
    }
    default:
      throw new Error(`Unsupported encoding ${encoding}`);
  }
}

// Performance sensitive, skip the extra await when returning a blank image
// eslint-disable-next-line @typescript-eslint/promise-function-async
export function emptyVideoFrame(
  videoPlayer?: VideoPlayer,
  resizeWidth?: number,
): Promise<ImageBitmap> {
  const width = resizeWidth ?? 32;
  const size = videoPlayer?.codedSize() ?? { width, height: width };
  const data = new ImageData(size.width, size.height);
  return createImageBitmap(data, { resizeWidth });
}
