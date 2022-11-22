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
import type { Base16Theme } from "base16";

export const DEFAULT_STUDIO_NODE_PREFIX = "/studio_script/";

export const ROBOT_DESCRIPTION_PARAM = "/robot_description";

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
      base0B: "#ffa657", // string & date, item string
      base09: "#7ee787", // # & boolean
      base07: "#79c0ff", // text
      base08: "#ff7b72", // null, undefined, function, & symbol
      base0D: "#79c0ff", // label & arrow
      base03: text.secondary, // item string expanded
    },
    light: {
      base00: "transparent", // bg
      base0B: "#953800", // string & date, item string
      base09: "#116329", // # & boolean
      base07: "#0550ae", // text
      base08: "#cf222e", // null, undefined, function, & symbol
      base0D: "#0550ae", // label & arrow
      base03: text.secondary, // item string expanded
    },
  }[mode];
}

export const TAB_PANEL_TYPE = "Tab";
