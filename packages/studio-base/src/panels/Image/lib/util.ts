// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { CameraInfo, PinholeCameraModel } from "@foxglove/den/image";
import { Topic } from "@foxglove/studio-base/players/types";

import { Dimensions, MarkerData, RawMarkerData, ZoomMode } from "../types";

export function calculateZoomScale(
  bitmap: Dimensions,
  viewport: Dimensions,
  zoomMode: ZoomMode,
): number {
  let imageViewportScale = viewport.width / bitmap.width;

  const calculatedHeight = bitmap.height * imageViewportScale;

  // if we are trying to fit and the height exeeds viewport, we need to scale on height
  if (zoomMode === "fit" && calculatedHeight > viewport.height) {
    imageViewportScale = viewport.height / bitmap.height;
  }

  // if we are trying to fill and the height doesn't fill viewport, we need to scale on height
  if (zoomMode === "fill" && calculatedHeight < viewport.height) {
    imageViewportScale = viewport.height / bitmap.height;
  }

  if (zoomMode === "other") {
    imageViewportScale = 1;
  }

  return imageViewportScale;
}

function toPaddedHexString(n: number, length: number) {
  const str = n.toString(16);
  return "0".repeat(length - str.length) + str;
}

/**
 * Converts an integer index into a hex color value. Used for encoding
 * hitmaps.
 */
export function indexToIDColor(index: number): string {
  return toPaddedHexString(index, 6);
}

/**
 * Converts an encoded color back to an index value. Used for decoding hitmaps.
 */
export function idColorToIndex(id: Uint8ClampedArray): number | undefined {
  // Treat pixels without max alpha as empty to avoid blended regions.
  if (id.length < 4 || id[3] !== 255) {
    return undefined;
  }

  return (id[0]! << 16) + (id[1]! << 8) + id[2]!;
}

export function getMarkerOptions(
  imageTopic: string,
  topics: readonly Topic[],
  imageMarkerDatatypes: readonly string[],
): string[] {
  const results = [];
  const cameraNamespace = getCameraNamespace(imageTopic);
  for (const { name, datatype } of topics) {
    if (
      cameraNamespace &&
      name.startsWith(cameraNamespace + "/") &&
      imageMarkerDatatypes.includes(datatype)
    ) {
      results.push(name);
    }
  }
  return results.sort();
}

export function getRelatedMarkerTopics(
  enabledMarkerTopics: string[],
  availableMarkerTopics: string[],
): string[] {
  return availableMarkerTopics.filter((topic) => {
    return enabledMarkerTopics.some((enabledTopic) =>
      // Splitting with a non-empty string will always produce an array of at least 1 element
      // "If the string and separator are both empty strings, an empty array is returned"
      topic.endsWith(enabledTopic.split("/").pop()!),
    );
  });
}

// get the sensor_msgs/CameraInfo topic associated with an image topic
export function getCameraInfoTopic(imageTopic: string): string | undefined {
  const cameraNamespace = getCameraNamespace(imageTopic);
  if (cameraNamespace) {
    return `${cameraNamespace}/camera_info`;
  }
  return undefined;
}

export function getCameraNamespace(topicName: string): string | undefined {
  let splitTopic = topicName.split("/");
  // Remove the last part of the selected topic to get the camera namespace.
  splitTopic.pop();
  splitTopic = splitTopic.filter((topicPart) => topicPart !== "old");

  // Since there is a leading slash in the topicName, splitTopic will always have at least one empty string to start.
  // If we can't find the namespace, return undefined.
  return splitTopic.length > 1 ? splitTopic.join("/") : undefined;
}

export function buildMarkerData(rawMarkerData: RawMarkerData): MarkerData | undefined {
  const { markers, transformMarkers, cameraInfo } = rawMarkerData;
  if (markers.length === 0) {
    return {
      markers,
      cameraModel: undefined,
      originalHeight: undefined,
      originalWidth: undefined,
    };
  }
  let cameraModel;
  if (transformMarkers) {
    if (!cameraInfo) {
      return undefined;
    }
    cameraModel = new PinholeCameraModel(cameraInfo as CameraInfo);
  }

  return {
    markers,
    cameraModel,
    originalWidth: cameraInfo?.width,
    originalHeight: cameraInfo?.height,
  };
}
