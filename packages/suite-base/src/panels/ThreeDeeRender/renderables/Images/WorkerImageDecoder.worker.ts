// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { RawImage } from "@foxglove/schemas";

import * as Comlink from "@lichtblick/comlink";

import type { CompressedImageTypes } from "./ImageTypes";
import { CompressedDepthFormat, decodeCompressedDepthToRawImage } from "./decodeCompressedDepth";
import { decodeRawImage, RawImageOptions } from "./decodeImage";
import type { Image as RosImage } from "../../ros";

function decode(image: RosImage | RawImage, options: Partial<RawImageOptions>): ImageData {
  const result = new ImageData(image.width, image.height);
  decodeRawImage(image, options, result.data);
  return Comlink.transfer(result, [result.data.buffer]);
}

/**
 * Unpacks a `compressed_depth_image_transport` image and decodes the raw image it contains, so
 * both the inflate and the per-pixel conversion stay off the main thread.
 */
async function decodeCompressedDepth(
  image: CompressedImageTypes,
  format: CompressedDepthFormat,
  options: Partial<RawImageOptions>,
): Promise<ImageData> {
  const rawImage = await decodeCompressedDepthToRawImage(image, format);
  return decode(rawImage, options);
}

export const service = {
  decode,
  decodeCompressedDepth,
};
Comlink.expose(service);
