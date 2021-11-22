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

import { ComponentType } from "react";

import GridSettingsEditor from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/GridSettingsEditor";
import UrdfSettingsEditor from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/UrdfSettingsEditor";
import { TopicSettingsEditorProps } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/types";
import { FOXGLOVE_GRID_DATATYPE, URDF_DATATYPE } from "@foxglove/studio-base/util/globalConstants";

import LaserScanSettingsEditor from "./LaserScanSettingsEditor";
import MarkerSettingsEditor from "./MarkerSettingsEditor";
import PointCloudSettingsEditor from "./PointCloudSettingsEditor";
import PoseSettingsEditor from "./PoseSettingsEditor";

export type { TopicSettingsEditorProps } from "./types";

export function topicSettingsEditorForDatatype(datatype: string):
  | (ComponentType<TopicSettingsEditorProps<unknown, Record<string, unknown>>> & {
      canEditNamespaceOverrideColor?: boolean;
    })
  | undefined {
  const editors = new Map<string, unknown>([
    [FOXGLOVE_GRID_DATATYPE, GridSettingsEditor],
    [URDF_DATATYPE, UrdfSettingsEditor],
    ["sensor_msgs/PointCloud2", PointCloudSettingsEditor],
    ["sensor_msgs/msg/PointCloud2", PointCloudSettingsEditor],
    ["velodyne_msgs/VelodyneScan", PointCloudSettingsEditor],
    ["velodyne_msgs/msg/VelodyneScan", PointCloudSettingsEditor],
    ["geometry_msgs/PoseStamped", PoseSettingsEditor],
    ["geometry_msgs/msg/PoseStamped", PoseSettingsEditor],
    ["sensor_msgs/LaserScan", LaserScanSettingsEditor],
    ["sensor_msgs/msg/LaserScan", LaserScanSettingsEditor],
    ["visualization_msgs/Marker", MarkerSettingsEditor],
    ["visualization_msgs/msg/Marker", MarkerSettingsEditor],
    ["visualization_msgs/MarkerArray", MarkerSettingsEditor],
    ["visualization_msgs/msg/MarkerArray", MarkerSettingsEditor],
    ["nav_msgs/Path", MarkerSettingsEditor],
    ["nav_msgs/msg/Path", MarkerSettingsEditor],
  ]);

  return editors.get(datatype) as
    | (ComponentType<TopicSettingsEditorProps<unknown, Record<string, unknown>>> & {
        canEditNamespaceOverrideColor?: boolean;
      })
    | undefined;
}

export function canEditDatatype(datatype: string): boolean {
  return topicSettingsEditorForDatatype(datatype) != undefined;
}

export function canEditNamespaceOverrideColorDatatype(datatype: string): boolean {
  const editor = topicSettingsEditorForDatatype(datatype);
  return editor?.canEditNamespaceOverrideColor === true;
}
