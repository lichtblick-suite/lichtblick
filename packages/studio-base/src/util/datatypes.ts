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

import { definitions as commonDefs } from "@foxglove/rosmsg-msgs-common";
import { definitions as foxgloveDefs } from "@foxglove/rosmsg-msgs-foxglove";
import { RosDatatypes, OptionalRosMsgDefinition } from "@foxglove/studio-base/types/RosDatatypes";

// https://foxglove.dev/docs/studio/messages/introduction
const foxgloveDatatypesObj: Record<string, OptionalRosMsgDefinition> = {
  "foxglove.GeoJSON": {
    name: "foxglove.GeoJSON",
    definitions: [{ name: "geojson", type: "string" }],
  },
  "foxglove.LocationFix": {
    name: "foxglove.LocationFix",
    definitions: [
      { name: "latitude", type: "float64" },
      { name: "longitude", type: "float64" },
      { name: "altitude", type: "float64", optional: true },
      {
        name: "position_covariance",
        isArray: true,
        type: "float64",
        optional: true,
      },
      { name: "position_covariance_type", type: "uint8", optional: true },
    ],
  },
  "foxglove.Log": {
    name: "foxglove.Log",
    definitions: [
      { name: "timestamp", type: "uint64" },
      { name: "level", type: "uint8" },
      { name: "message", type: "string" },
      { name: "name", type: "string" },
      { name: "file", type: "string" },
      { name: "line", type: "uint32" },
    ],
  },
  "foxglove.Grid.Field": {
    name: "foxglove.Grid.Field",
    definitions: [
      { name: "name", type: "string" },
      { name: "type", type: "uint8" },
      { name: "offset", type: "uint32" },
    ],
  },
  "foxglove.Vector3": {
    name: "foxglove.Vector3",
    definitions: [
      { name: "x", type: "float64" },
      { name: "y", type: "float64" },
      { name: "z", type: "float64" },
    ],
  },
  "foxglove.Vector2": {
    name: "foxglove.Vector2",
    definitions: [
      { name: "x", type: "float64" },
      { name: "y", type: "float64" },
    ],
  },
  "foxglove.Quaternion": {
    name: "foxglove.Quaternion",
    definitions: [
      { name: "x", type: "float64" },
      { name: "y", type: "float64" },
      { name: "z", type: "float64" },
      { name: "w", type: "float64" },
    ],
  },
  "foxglove.Pose": {
    name: "foxglove.Pose",
    definitions: [
      { name: "position", type: "foxglove.Vector3", isComplex: true },
      { name: "orientation", type: "foxglove.Quaternion", isComplex: true },
    ],
  },
  "foxglove.Grid": {
    name: "foxglove.Grid",
    definitions: [
      { name: "timestamp", type: "time" },
      { name: "frame_id", type: "string" },
      { name: "pose", type: "foxglove.Pose", isComplex: true },
      { name: "column_count", type: "uint32" },
      { name: "cell_size", type: "foxglove.Vector2", isComplex: true },
      { name: "row_stride", type: "uint32" },
      { name: "cell_stride", type: "uint32" },
      { name: "fields", type: "foxglove.Grid.Field", isArray: true },
      { name: "data", type: "uint8", isArray: true },
    ],
  },
  "foxglove.PointCloud": {
    name: "foxglove.PointCloud",
    definitions: [
      { name: "timestamp", type: "time" },
      { name: "frame_id", type: "string" },
      { name: "pose", type: "foxglove.Pose" },
      { name: "point_stride", type: "uint32" },
      { name: "fields", type: "foxglove.Grid.Field", isArray: true },
      { name: "data", type: "uint8", isArray: true },
    ],
  },
  "foxglove.LaserScan": {
    name: "foxglove.LaserScan",
    definitions: [
      { name: "timestamp", type: "time" },
      { name: "frame_id", type: "string" },
      { name: "pose", type: "foxglove.Pose", isComplex: true },
      { name: "start_angle", type: "float64" },
      { name: "end_angle", type: "float64" },
      { name: "ranges", type: "float64", isArray: true },
      { name: "intensities", type: "float64", isArray: true },
    ],
  },
};

/**
 * basicDatatypes is a map containing definitions for ROS common datatypes and foxglove datatypes
 * from the following packages:
 *
 * - @foxglove/rosmsgs-msg-common
 * - @foxglove/rosmsg-msgs-foxglove
 */
export const basicDatatypes: RosDatatypes = new Map();

for (const [name, def] of Object.entries(commonDefs)) {
  basicDatatypes.set(name, def);
}
for (const [name, def] of Object.entries(foxgloveDefs)) {
  basicDatatypes.set(name, def);
}

export const foxgloveDatatypes: RosDatatypes = new Map(Object.entries(foxgloveDatatypesObj));
