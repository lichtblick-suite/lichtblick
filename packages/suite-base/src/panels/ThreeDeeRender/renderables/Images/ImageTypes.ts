// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CompressedImage, RawImage } from "@foxglove/schemas";

import { Time } from "@lichtblick/rostime";
import { CAMERA_CALIBRATION_DATATYPES } from "@lichtblick/suite-base/panels/ThreeDeeRender/foxglove";

import {
  Image as RosImage,
  CompressedImage as RosCompressedImage,
  CAMERA_INFO_DATATYPES,
} from "../../ros";

export const ALL_CAMERA_INFO_SCHEMAS = new Set([
  ...CAMERA_INFO_DATATYPES,
  ...CAMERA_CALIBRATION_DATATYPES,
]);

/** NOTE: Remove this definition once it is available in @foxglove/schemas */
export type CompressedVideo = {
  timestamp: Time;
  frame_id: string;
  data: Uint8Array;
  format: string;
};

export type CompressedImageTypes = RosCompressedImage | CompressedImage;

export type AnyImage = RosImage | RosCompressedImage | RawImage | CompressedImage | CompressedVideo;

export function getFrameIdFromImage(image: AnyImage): string {
  if ("header" in image) {
    return image.header.frame_id;
  } else {
    return image.frame_id;
  }
}

export function getTimestampFromImage(image: AnyImage): Time {
  if ("header" in image) {
    return image.header.stamp;
  } else {
    return image.timestamp;
  }
}

/**
 * Adapts any compressed image message to the `CompressedVideo` shape the video decode path works
 * with. Encoded video streams are routed there purely by codec `format`, and `sensor_msgs/
 * CompressedImage` is commonly published with such a format even though it keeps its time and
 * frame in `header`. Every consumer of a video frame must go through this so no code path reads
 * `timestamp`/`frame_id` off a message that does not have them.
 */
export function toCompressedVideoFrame(
  image: CompressedImageTypes | CompressedVideo,
): CompressedVideo {
  if (!("header" in image)) {
    return image;
  }
  return {
    timestamp: image.header.stamp,
    frame_id: image.header.frame_id,
    data: image.data,
    format: image.format,
  };
}
