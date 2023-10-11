// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Time } from "@foxglove/rostime";
import { CompressedImage, RawImage } from "@foxglove/schemas";
import { CAMERA_CALIBRATION_DATATYPES } from "@foxglove/studio-base/panels/ThreeDeeRender/foxglove";

import {
  Image as RosImage,
  CompressedImage as RosCompressedImage,
  CAMERA_INFO_DATATYPES,
} from "../../ros";

export const ALL_CAMERA_INFO_SCHEMAS = new Set([
  ...CAMERA_INFO_DATATYPES,
  ...CAMERA_CALIBRATION_DATATYPES,
]);

export type CompressedImageTypes = RosCompressedImage | CompressedImage;

export type AnyImage = RosImage | RosCompressedImage | RawImage | CompressedImage;

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
