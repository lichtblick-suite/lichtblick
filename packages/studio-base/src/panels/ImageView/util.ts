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

import { Topic, MessageEvent } from "@foxglove/studio-base/players/types";
import { CameraInfo } from "@foxglove/studio-base/types/Messages";

import PinholeCameraModel from "./PinholeCameraModel";

export type RenderOptions = {
  imageSmoothing?: boolean;
  minValue?: number;
  maxValue?: number;

  // resize the canvas element to fit the bitmap
  // default is false
  resizeCanvas?: boolean;
};

export type Dimensions = { width: number; height: number };

export type RawMarkerData = {
  markers: MessageEvent<unknown>[];
  transformMarkers: boolean;
  cameraInfo?: CameraInfo;
};

export type MarkerData = {
  markers: MessageEvent<unknown>[];
  originalWidth?: number; // undefined means no scaling is needed (use the image's size)
  originalHeight?: number; // undefined means no scaling is needed (use the image's size)
  cameraModel?: PinholeCameraModel; // undefined means no transformation is needed
};

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
      cameraNamespace &&
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

// group topics by the first component of their name
export function groupTopics(topics: Topic[]): Map<string, Topic[]> {
  const imageTopicsByNamespace: Map<string, Topic[]> = new Map();
  for (const topic of topics) {
    const key = getCameraNamespace(topic.name) ?? topic.name;
    const vals = imageTopicsByNamespace.get(key);
    if (vals) {
      vals.push(topic);
    } else {
      imageTopicsByNamespace.set(key, [topic]);
    }
  }
  return imageTopicsByNamespace;
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
    cameraModel = new PinholeCameraModel(cameraInfo);
  }

  return {
    markers,
    cameraModel,
    originalWidth: cameraInfo?.width,
    originalHeight: cameraInfo?.height,
  };
}
