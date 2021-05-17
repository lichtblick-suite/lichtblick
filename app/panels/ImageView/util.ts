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

import clamp from "lodash/clamp";

import { Topic, MessageEvent } from "@foxglove/studio-base/players/types";
import { CameraInfo } from "@foxglove/studio-base/types/Messages";
import {
  isNonEmptyOrUndefined,
  nonEmptyOrUndefined,
} from "@foxglove/studio-base/util/emptyOrUndefined";

import CameraModel from "./CameraModel";

// The OffscreenCanvas type is not yet in Flow. It's similar to, but more restrictive than HTMLCanvasElement.
// TODO: change this to the Flow definition once it's been added.
export type OffscreenCanvas = HTMLCanvasElement;

export type RenderOptions = {
  minValue?: number;
  maxValue?: number;
};

export type Dimensions = { width: number; height: number };

export type MarkerOption = {
  topic: string;
  name: string;
};

export type RawMarkerData = {
  markers: MessageEvent<unknown>[];
  scale: number;
  transformMarkers: boolean;
  cameraInfo?: CameraInfo;
};

export type MarkerData =
  | {
      markers: MessageEvent<unknown>[];
      originalWidth?: number; // undefined means no scaling is needed (use the image's size)
      originalHeight?: number; // undefined means no scaling is needed (use the image's size)
      cameraModel?: CameraModel; // undefined means no transformation is needed
    }
  | undefined;

export function getMarkerOptions(
  imageTopic: string,
  topics: readonly Topic[],
  _allCameraNamespaces: string[],
  imageMarkerDatatypes: string[],
): string[] {
  const results = [];
  const cameraNamespace = getCameraNamespace(imageTopic);
  for (const { name, datatype } of topics) {
    if (
      isNonEmptyOrUndefined(cameraNamespace) &&
      (name.startsWith(cameraNamespace) || name.startsWith(`/old${cameraNamespace}`)) &&
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      topic.endsWith(enabledTopic.split("/").pop()!),
    );
  });
}

// get the sensor_msgs/CameraInfo topic associated with an image topic
export function getCameraInfoTopic(imageTopic: string): string | undefined {
  const cameraNamespace = getCameraNamespace(imageTopic);
  if (isNonEmptyOrUndefined(cameraNamespace)) {
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

// group topics by the first component of their name
export function groupTopics(topics: Topic[]): Map<string, Topic[]> {
  const imageTopicsByNamespace: Map<string, Topic[]> = new Map();
  for (const topic of topics) {
    const key = nonEmptyOrUndefined(getCameraNamespace(topic.name)) ?? topic.name;
    const vals = imageTopicsByNamespace.get(key);
    if (vals) {
      vals.push(topic);
    } else {
      imageTopicsByNamespace.set(key, [topic]);
    }
  }
  return imageTopicsByNamespace;
}

// check if we pan out of bounds with the given top, left, right, bottom
// x, y, scale is the state after we pan
// if out of bound, return newX and newY satisfying the bounds
// else, return the original x and y
export function checkOutOfBounds(
  x: number,
  y: number,
  outsideWidth: number,
  outsideHeight: number,
  insideWidth: number,
  insideHeight: number,
): number[] {
  const leftX = 0;
  const topY = 0;
  const rightX = outsideWidth - insideWidth;
  const bottomY = outsideHeight - insideHeight;
  return [
    clamp(x, Math.min(leftX, rightX), Math.max(leftX, rightX)),
    clamp(y, Math.min(topY, bottomY), Math.max(topY, bottomY)),
  ];
}

export function buildMarkerData(rawMarkerData: RawMarkerData): MarkerData | undefined {
  const { markers, scale, transformMarkers, cameraInfo } = rawMarkerData;
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
    cameraModel = new CameraModel(cameraInfo);
  }

  // Markers can only be rendered if we know the original size of the image.
  // Prefer using CameraInfo to determine the image size.
  let originalWidth: number | undefined = cameraInfo?.width ?? 0;
  let originalHeight: number | undefined = cameraInfo?.height ?? 0;
  if (originalWidth <= 0 || originalHeight <= 0) {
    if (scale === 1) {
      // Otherwise, if scale === 1, the image was not downsampled, so the size of the bitmap is accurate.
      originalWidth = undefined;
      originalHeight = undefined;
    } else {
      return undefined;
    }
  }

  return {
    markers,
    cameraModel,
    originalWidth,
    originalHeight,
  };
}
