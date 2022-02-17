// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromNanoSec } from "@foxglove/rostime";
import { CompressedImage, Image } from "@foxglove/studio-base/types/Messages";

type RawImageMessage = {
  type: "raw";
  stamp: { sec: number; nsec: number };
  width: number;
  height: number;
  is_bigendian: boolean;
  encoding: string;
  step: number;
  data: Uint8Array;
};

type CompressedImageMessage = {
  type: "compressed";
  stamp: { sec: number; nsec: number };
  format: string;
  data: Uint8Array;
};

type FoxgloveRawImageMessage = {
  timestamp: bigint;
  width: number;
  height: number;
  encoding: string;
  step: number;
  data: Uint8Array;
};

type FoxgloveCompressedImageMessage = {
  type: "compressed";
  timestamp: bigint;
  format: string;
  data: Uint8Array;
};

export type NormalizedImageMessage = RawImageMessage | CompressedImageMessage;

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
];

/**
 * Convert a message based on datatype to a NormalizedImageMessage
 * A NormalizedImageMessage defines consistent semantics across different frameworks
 */
export function normalizeImageMessage(
  message: unknown,
  datatype: string,
): NormalizedImageMessage | undefined {
  switch (datatype) {
    case "foxglove.RawImage": {
      const typedMessage = message as FoxgloveRawImageMessage;
      const stamp = fromNanoSec(typedMessage.timestamp);
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
    case "foxglove.CompressedImage": {
      const typedMessage = message as FoxgloveCompressedImageMessage;
      const stamp = fromNanoSec(typedMessage.timestamp);
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
