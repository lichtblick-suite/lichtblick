// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CompressedImage, RawImage } from "@foxglove/schemas";
import { PartialMessage } from "@foxglove/studio-base/panels/ThreeDeeRender/SceneExtension";

import { normalizeByteArray, normalizeHeader, normalizeTime } from "../../normalizeMessages";
import { Image as RosImage, CompressedImage as RosCompressedImage } from "../../ros";

function normalizeImageData(data: Int8Array): Int8Array;
function normalizeImageData(data: PartialMessage<Uint8Array> | undefined): Uint8Array;
function normalizeImageData(data: unknown): Int8Array | Uint8Array;
function normalizeImageData(data: unknown): Int8Array | Uint8Array {
  if (data == undefined) {
    return new Uint8Array(0);
  } else if (data instanceof Int8Array || data instanceof Uint8Array) {
    return data;
  } else {
    return new Uint8Array(0);
  }
}

export function normalizeRosImage(message: PartialMessage<RosImage>): RosImage {
  return {
    header: normalizeHeader(message.header),
    height: message.height ?? 0,
    width: message.width ?? 0,
    encoding: message.encoding ?? "",
    is_bigendian: message.is_bigendian ?? false,
    step: message.step ?? 0,
    data: normalizeImageData(message.data),
  };
}

export function normalizeRosCompressedImage(
  message: PartialMessage<RosCompressedImage>,
): RosCompressedImage {
  return {
    header: normalizeHeader(message.header),
    format: message.format ?? "",
    data: normalizeByteArray(message.data),
  };
}

export function normalizeRawImage(message: PartialMessage<RawImage>): RawImage {
  return {
    timestamp: normalizeTime(message.timestamp),
    frame_id: message.frame_id ?? "",
    height: message.height ?? 0,
    width: message.width ?? 0,
    encoding: message.encoding ?? "",
    step: message.step ?? 0,
    data: normalizeImageData(message.data),
  };
}

export function normalizeCompressedImage(
  message: PartialMessage<CompressedImage>,
): CompressedImage {
  return {
    timestamp: normalizeTime(message.timestamp),
    frame_id: message.frame_id ?? "",
    format: message.format ?? "",
    data: normalizeByteArray(message.data),
  };
}
