// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { PointsAnnotationType } from "@foxglove/schemas";
import { filterMap } from "@lichtblick/den/collection";
import { fromNanoSec } from "@lichtblick/rostime";
import { ImageMarkerType, } from "@lichtblick/suite-base/types/Messages";
import { mightActuallyBePartial } from "@lichtblick/suite-base/util/mightActuallyBePartial";
// Should mirror TextAnnotation.font_size default value
const DEFAULT_FONT_SIZE = 12;
const DEFAULT_PADDING = 4;
function foxglovePointTypeToStyle(type) {
    switch (type) {
        case PointsAnnotationType.UNKNOWN:
        case PointsAnnotationType.POINTS:
            return "points";
        case PointsAnnotationType.LINE_LOOP:
            return "polygon";
        case PointsAnnotationType.LINE_STRIP:
            return "line_strip";
        case PointsAnnotationType.LINE_LIST:
            return "line_list";
    }
    return undefined;
}
function normalizeFoxgloveImageAnnotations(message) {
    const annotations = [];
    const circles = message.circles ?? [];
    for (let i = 0; i < circles.length; i++) {
        const circle = circles[i];
        const stamp = normalizeTimestamp(circle.timestamp);
        annotations.push({
            type: "circle",
            stamp,
            fillColor: circle.fill_color,
            outlineColor: circle.outline_color,
            radius: circle.diameter / 2.0,
            thickness: circle.thickness,
            position: circle.position,
            messagePath: ["circles", i],
        });
    }
    const points = message.points ?? [];
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const style = foxglovePointTypeToStyle(point.type);
        if (!style) {
            continue;
        }
        const stamp = normalizeTimestamp(point.timestamp);
        annotations.push({
            type: "points",
            stamp,
            style,
            points: point.points,
            outlineColors: point.outline_colors,
            outlineColor: mightActuallyBePartial(point).outline_color ?? { r: 1, g: 1, b: 1, a: 1 },
            thickness: mightActuallyBePartial(point).thickness ?? 1,
            fillColor: point.fill_color,
            messagePath: ["points", i],
        });
    }
    const texts = message.texts ?? [];
    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        const stamp = normalizeTimestamp(text.timestamp);
        annotations.push({
            type: "text",
            stamp,
            position: text.position,
            text: text.text,
            textColor: text.text_color,
            backgroundColor: text.background_color,
            fontSize: text.font_size,
            padding: (text.font_size / DEFAULT_FONT_SIZE) * DEFAULT_PADDING,
            messagePath: ["texts", i],
        });
    }
    return annotations;
}
function normalizeTimestamp(stamp) {
    return typeof stamp === "bigint" ? fromNanoSec(stamp) : stamp;
}
function normalizeRosImageMarkerArray(message) {
    return filterMap(message.markers, (marker, i) => normalizeRosImageMarker(marker, ["markers", i]));
}
function imageMarkerTypeToStyle(type) {
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
function normalizeRosImageMarker(message, messagePath) {
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
                messagePath,
            };
        case ImageMarkerType.TEXT:
            return {
                type: "text",
                stamp: message.header.stamp,
                position: message.position,
                text: message.text?.data ?? "",
                textColor: message.outline_color,
                backgroundColor: message.filled ? message.fill_color : undefined,
                fontSize: message.scale * DEFAULT_FONT_SIZE,
                padding: DEFAULT_PADDING * message.scale,
                messagePath,
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
                messagePath,
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
                messagePath,
            };
        }
    }
    return undefined;
}
function normalizeAnnotations(message, datatype) {
    // Cast to the union of all supported datatypes to ensure we handle all cases
    switch (datatype) {
        // single marker
        case "visualization_msgs/ImageMarker":
        case "visualization_msgs/msg/ImageMarker":
        case "ros.visualization_msgs.ImageMarker": {
            const normalized = normalizeRosImageMarker(message, []);
            return normalized ? [normalized] : [];
        }
        // marker arrays
        case "foxglove_msgs/ImageMarkerArray":
        case "foxglove_msgs/msg/ImageMarkerArray":
        case "studio_msgs/ImageMarkerArray":
        case "studio_msgs/msg/ImageMarkerArray":
        case "visualization_msgs/ImageMarkerArray":
        case "visualization_msgs/msg/ImageMarkerArray":
        case "ros.visualization_msgs.ImageMarkerArray":
            return normalizeRosImageMarkerArray(message);
        // backwards compat with webviz
        case "webviz_msgs/ImageMarkerArray":
            break;
        // foxglove
        case "foxglove_msgs/ImageAnnotations":
        case "foxglove_msgs/msg/ImageAnnotations":
        case "foxglove::ImageAnnotations":
        case "foxglove.ImageAnnotations": {
            return normalizeFoxgloveImageAnnotations(message);
        }
    }
    return [];
}
/** Only used for getting details to display from original message */
function getAnnotationAtPath(message, path) {
    let value = message;
    for (const key of path) {
        if (key in value) {
            value = value[key];
        }
    }
    return value;
}
export { normalizeAnnotations, getAnnotationAtPath };
