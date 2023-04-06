// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromNanoSec } from "@foxglove/rostime";
import { FoxgloveMessages } from "@foxglove/studio-base/types/FoxgloveMessages";
import { CompressedImage, Image } from "@foxglove/studio-base/types/Messages";

import { NormalizedImageMessage } from "../types";

// Supported datatypes for normalization
export const NORMALIZABLE_IMAGE_DATATYPES = [
  "sensor_msgs/Image",
  "sensor_msgs/msg/Image",
  "ros.sensor_msgs.Image",
  "sensor_msgs/CompressedImage",
  "sensor_msgs/msg/CompressedImage",
  "ros.sensor_msgs.CompressedImage",
  "foxglove.RawImage",
  "foxglove.CompressedImage",
  "foxglove_msgs/RawImage",
  "foxglove_msgs/msg/RawImage",
  "foxglove_msgs/CompressedImage",
  "foxglove_msgs/msg/CompressedImage",
] as const;

/**
 * Convert a message based on datatype to a NormalizedImageMessage
 * A NormalizedImageMessage defines consistent semantics across different frameworks
 */
export function normalizeImageMessage(
  message: unknown,
  datatype: string,
): NormalizedImageMessage | undefined {
  // Cast to the union of all supported datatypes to ensure we handle all cases
  switch (datatype as (typeof NORMALIZABLE_IMAGE_DATATYPES)[number]) {
    case "foxglove_msgs/RawImage":
    case "foxglove_msgs/msg/RawImage":
    case "foxglove.RawImage": {
      const typedMessage = message as FoxgloveMessages["foxglove.RawImage"];
      const stamp =
        typeof typedMessage.timestamp === "bigint"
          ? fromNanoSec(typedMessage.timestamp)
          : typedMessage.timestamp;
      return {
        type: "raw",
        stamp,
        width: typedMessage.width,
        height: typedMessage.height,
        is_bigendian: false,
        encoding: typedMessage.encoding,
        step: typedMessage.step,
        data: typedMessage.data,
      };
    }
    case "sensor_msgs/Image":
    case "sensor_msgs/msg/Image":
    case "ros.sensor_msgs.Image": {
      const typedMessage = message as Image;
      return {
        type: "raw",
        stamp: typedMessage.header.stamp,
        width: typedMessage.width,
        height: typedMessage.height,
        is_bigendian: typedMessage.is_bigendian,
        encoding: typedMessage.encoding,
        step: typedMessage.step,
        data: typedMessage.data,
      };
    }
    case "sensor_msgs/CompressedImage":
    case "sensor_msgs/msg/CompressedImage":
    case "ros.sensor_msgs.CompressedImage": {
      const typedMessage = message as CompressedImage;
      return {
        type: "compressed",
        stamp: typedMessage.header.stamp,
        format: typedMessage.format,
        data: typedMessage.data,
      };
    }
    case "foxglove_msgs/CompressedImage":
    case "foxglove_msgs/msg/CompressedImage":
    case "foxglove.CompressedImage": {
      const typedMessage = message as FoxgloveMessages["foxglove.CompressedImage"];
      const stamp =
        typeof typedMessage.timestamp === "bigint"
          ? fromNanoSec(typedMessage.timestamp)
          : typedMessage.timestamp;
      return {
        type: "compressed",
        stamp,
        format: typedMessage.format,
        data: typedMessage.data,
      };
    }
  }

  return undefined;
}
