// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { filterMap } from "@foxglove/den/collection";
import { fromNanoSec } from "@foxglove/rostime";
import { ImageAnnotations, type PointsAnnotationType } from "@foxglove/schemas/schemas/typescript";
import {
  ImageMarker,
  ImageMarkerArray,
  ImageMarkerType,
} from "@foxglove/studio-base/types/Messages";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

import type { Annotation, PointsAnnotation } from "../types";

function foxglovePointTypeToStyle(
  type: PointsAnnotationType,
): PointsAnnotation["style"] | undefined {
  switch (type) {
    // casting required for now because enum imports don't work: https://github.com/foxglove/schemas/issues/41
    case 0 as PointsAnnotationType.UNKNOWN:
    case 1 as PointsAnnotationType.POINTS:
      return "points";
    case 2 as PointsAnnotationType.LINE_LOOP:
      return "polygon";
    case 3 as PointsAnnotationType.LINE_STRIP:
      return "line_strip";
    case 4 as PointsAnnotationType.LINE_LIST:
      return "line_list";
  }
  return undefined;
}

function normalizeFoxgloveImageAnnotations(
  message: Partial<ImageAnnotations>,
): Annotation[] | undefined {
  if (!message.circles && !message.points) {
    return undefined;
  }

  if (message.circles?.length === 0 && message.points?.length === 0) {
    return undefined;
  }

  const annotations: Annotation[] = [];

  for (const circle of message.circles ?? []) {
    const stamp =
      typeof circle.timestamp === "bigint" ? fromNanoSec(circle.timestamp) : circle.timestamp;
    annotations.push({
      type: "circle",
      stamp,
      fillColor: circle.fill_color,
      outlineColor: circle.outline_color,
      radius: circle.diameter / 2.0,
      thickness: circle.thickness,
      position: circle.position,
    });
  }
  for (const point of message.points ?? []) {
    const style = foxglovePointTypeToStyle(point.type);
    if (!style) {
      continue;
    }
    const stamp =
      typeof point.timestamp === "bigint" ? fromNanoSec(point.timestamp) : point.timestamp;
    annotations.push({
      type: "points",
      stamp,
      style,
      points: point.points,
      outlineColors: point.outline_colors,
      outlineColor: mightActuallyBePartial(point).outline_color ?? { r: 1, g: 1, b: 1, a: 1 },
      thickness: mightActuallyBePartial(point).thickness ?? 1,
      fillColor: point.fill_color,
    });
  }

  return annotations;
}

function normalizeRosImageMarkerArray(message: ImageMarkerArray): Annotation[] | undefined {
  return filterMap(message.markers, (marker) => normalizeRosImageMarker(marker));
}

function imageMarkerTypeToStyle(
  type:
    | ImageMarkerType.LINE_LIST
    | ImageMarkerType.LINE_STRIP
    | ImageMarkerType.POINTS
    | ImageMarkerType.POLYGON,
): PointsAnnotation["style"] {
  switch (type) {
    case ImageMarkerType.LINE_LIST:
      return "line_list";
    case ImageMarkerType.LINE_STRIP:
      return "line_strip";
    case ImageMarkerType.POINTS:
      return "points";
    case ImageMarkerType.POLYGON:
      return "polygon";
  }
}

function normalizeRosImageMarker(message: ImageMarker): Annotation | undefined {
  switch (message.type) {
    case ImageMarkerType.CIRCLE:
      return {
        type: "circle",
        stamp: message.header.stamp,
        fillColor: message.filled ? message.fill_color : undefined,
        outlineColor: message.outline_color,
        radius: message.scale,
        thickness: 1.0,
        position: message.position,
      };
    case ImageMarkerType.TEXT:
      return {
        type: "text",
        stamp: message.header.stamp,
        position: message.position,
        text: message.text?.data ?? "",
        textColor: message.outline_color,
        backgroundColor: message.filled ? message.fill_color : undefined,
        fontSize: message.scale * 12,
        padding: 4 * message.scale,
      };
    case ImageMarkerType.POINTS:
      return {
        type: "points",
        stamp: message.header.stamp,
        style: "points",
        points: message.points,
        outlineColors: message.outline_colors,
        outlineColor: message.outline_color,
        thickness: message.scale,
        fillColor: message.fill_color,
      };
    case ImageMarkerType.LINE_LIST:
    case ImageMarkerType.LINE_STRIP:
    case ImageMarkerType.POLYGON: {
      const style = imageMarkerTypeToStyle(message.type);
      return {
        type: "points",
        stamp: message.header.stamp,
        style,
        points: message.points,
        outlineColors: message.outline_colors,
        outlineColor: message.outline_color,
        thickness: message.scale,
        fillColor: message.filled ? message.fill_color : undefined,
      };
    }
  }

  return undefined;
}

function toPOD(message: unknown): unknown {
  return "toJSON" in (message as object)
    ? (message as { toJSON: () => unknown }).toJSON()
    : message;
}

function normalizeAnnotations(
  maybeLazyMessage: unknown,
  datatype: string,
): Annotation[] | undefined {
  // The panel may send the annotations to a web worker, for this we need
  const message = toPOD(maybeLazyMessage);

  switch (datatype) {
    // single marker
    case "visualization_msgs/ImageMarker":
    case "visualization_msgs/msg/ImageMarker":
    case "ros.visualization_msgs.ImageMarker": {
      const normalized = normalizeRosImageMarker(message as ImageMarker);
      if (normalized) {
        return [normalized];
      }
      break;
    }
    // marker arrays
    case "foxglove_msgs/ImageMarkerArray":
    case "foxglove_msgs/msg/ImageMarkerArray":
    case "studio_msgs/ImageMarkerArray":
    case "studio_msgs/msg/ImageMarkerArray":
    case "visualization_msgs/ImageMarkerArray":
    case "visualization_msgs/msg/ImageMarkerArray":
    case "ros.visualization_msgs.ImageMarkerArray":
      return normalizeRosImageMarkerArray(message as ImageMarkerArray);
    // backwards compat with webviz
    case "webviz_msgs/ImageMarkerArray":
      break;
    // foxglove
    case "foxglove_msgs/ImageAnnotations":
    case "foxglove_msgs/msg/ImageAnnotations":
    case "foxglove.ImageAnnotations": {
      return normalizeFoxgloveImageAnnotations(message as ImageAnnotations);
    }
  }

  return undefined;
}

export { normalizeAnnotations };
