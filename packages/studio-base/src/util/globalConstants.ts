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
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

export const DEFAULT_STUDIO_NODE_PREFIX = "/studio_node/";

export const TRANSFORM_TOPIC = "/tf";
export const DIAGNOSTIC_TOPIC = "/diagnostics";
export const SECOND_SOURCE_PREFIX = "/studio_source_2";

export const COLOR_RGBA_DATATYPE = "std_msgs/ColorRGBA";
export const GEOMETRY_MSGS_POLYGON_STAMPED_DATATYPE = "geometry_msgs/PolygonStamped";
export const NAV_MSGS_OCCUPANCY_GRID_DATATYPE = "nav_msgs/OccupancyGrid";
export const NAV_MSGS_PATH_DATATYPE = "nav_msgs/Path";
export const POINT_CLOUD_DATATYPE = "sensor_msgs/PointCloud2";
export const POSE_STAMPED_DATATYPE = "geometry_msgs/PoseStamped";
export const SENSOR_MSGS_LASER_SCAN_DATATYPE = "sensor_msgs/LaserScan";
export const TRANSFORM_STAMPED_DATATYPE = "geometry_msgs/TransformStamped";
export const TF_DATATYPE = "tf/tfMessage";
export const TF2_DATATYPE = "tf2_msgs/TFMessage";
export const VELODYNE_SCAN_DATATYPE = "velodyne_msgs/VelodyneScan";
export const VISUALIZATION_MSGS_MARKER_DATATYPE = "visualization_msgs/Marker";
export const VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE = "visualization_msgs/MarkerArray";

export const FOXGLOVE_GRID_TOPIC = "/foxglove/grid";
export const FOXGLOVE_GRID_DATATYPE = "foxglove/Grid";

export const ROBOT_DESCRIPTION_PARAM = "/robot_description";

export const MARKER_ARRAY_DATATYPES = [VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE];

export const COLORS = {
  RED: { r: 1.0, g: 0.2, b: 0.2, a: 1.0 },
  BLUE: { r: 0.4, g: 0.4, b: 1.0, a: 1.0 },
  YELLOW: { r: 0.9, g: 1.0, b: 0.1, a: 1.0 },
  ORANGE: { r: 1.0, g: 0.6, b: 0.2, a: 1.0 },
  GREEN: { r: 0.1, g: 0.9, b: 0.3, a: 1.0 },
  GRAY: { r: 0.4, g: 0.4, b: 0.4, a: 1.0 },
  PURPLE: { r: 1.0, g: 0.2, b: 1.0, a: 1.0 },
  WHITE: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
  PINK: { r: 1.0, g: 0.4, b: 0.6, a: 1.0 },
  LIGHT_RED: { r: 0.9, g: 0.1, b: 0.1, a: 1.0 },
  LIGHT_GREEN: { r: 0.4, g: 0.9, b: 0.4, a: 1.0 },
  LIGHT_BLUE: { r: 0.4, g: 0.4, b: 1, a: 1.0 },
  CLEAR: { r: 0, g: 0, b: 0, a: 0 },
};

// http://docs.ros.org/melodic/api/visualization_msgs/html/msg/Marker.html
export const MARKER_MSG_TYPES = {
  ARROW: 0,
  CUBE: 1,
  SPHERE: 2,
  CYLINDER: 3,
  LINE_STRIP: 4,
  LINE_LIST: 5,
  CUBE_LIST: 6,
  SPHERE_LIST: 7,
  POINTS: 8,
  TEXT_VIEW_FACING: 9,
  MESH_RESOURCE: 10,
  TRIANGLE_LIST: 11,
  FILLED_POLYGON: 107,
  INSTANCED_LINE_LIST: 108,
  OVERLAY_ICON: 109,
} as const;

export const jsonTreeTheme = {
  base00: "transparent", // bg
  base07: colors.BLUEL1, // text
  base0B: colors.YELLOW1, // string & date, item string
  base09: colors.REDL1, // # & boolean
  base08: colors.RED, // null, undefined, function, & symbol
  base0D: colors.BLUEL1, // label & arrow
  base03: colors.DARK9, // item string expanded
};

export const TAB_PANEL_TYPE = "Tab";
