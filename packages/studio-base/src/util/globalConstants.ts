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
import { useTheme } from "@mui/material";
import { lightBlue, orange, pink, red, teal } from "@mui/material/colors";
import type { Base16Theme } from "base16";

export const DEFAULT_STUDIO_NODE_PREFIX = "/studio_script/";

export const FOXGLOVE_GRID_TOPIC = "/foxglove/grid";
export const FOXGLOVE_GRID_DATATYPE = "foxglove/Grid";

export const URDF_TOPIC = "/robot_description";
export const URDF_DATATYPE = "foxglove/RobotDescription";

export const ROBOT_DESCRIPTION_PARAM = "/robot_description";

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
  INSTANCED_LINE_LIST: 108,
} as const;

export function useJsonTreeTheme(): Pick<
  Base16Theme,
  "base00" | "base07" | "base0B" | "base09" | "base08" | "base0D" | "base03"
> {
  const {
    palette: { mode, text },
  } = useTheme();

  return {
    dark: {
      base00: "transparent", // bg
      base0B: orange[500], // string & date, item string
      base09: teal.A400, // # & boolean
      base07: lightBlue[500], // text
      base08: pink[500], // null, undefined, function, & symbol
      base0D: lightBlue[500], // label & arrow
      base03: text.secondary, // item string expanded
    },
    light: {
      base00: "transparent", // bg
      base0B: orange[900], // string & date, item string
      base09: teal[800], // # & boolean
      base07: lightBlue[800], // text
      base08: red[700], // null, undefined, function, & symbol
      base0D: lightBlue[800], // label & arrow
      base03: text.secondary, // item string expanded
    },
  }[mode];
}

export const TAB_PANEL_TYPE = "Tab";
