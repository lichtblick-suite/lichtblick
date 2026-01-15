// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { JSON_TREE_THEME_COLORS } from "@lichtblick/suite-base/util/constants";

/**
 * Get color for value type based on theme mode
 * @param value - The value to get color for
 * @param mode - Theme mode (light or dark)
 * @returns Color string or undefined for non-primitive types
 */
export function getValueColor(value: unknown, mode: "light" | "dark"): string | undefined {
  const colors = JSON_TREE_THEME_COLORS[mode];

  if (value == undefined) {
    return colors.null;
  }
  if (typeof value === "string") {
    return colors.string;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return colors.number;
  }
  if (typeof value === "boolean") {
    return colors.number;
  }
  return undefined;
}

export function useJsonTreeTheme(): Pick<
  Base16Theme,
  "base00" | "base07" | "base0B" | "base09" | "base08" | "base0D" | "base03"
> {
  const {
    palette: { mode, text },
  } = useTheme();

  const colors = JSON_TREE_THEME_COLORS[mode];

  return {
    dark: {
      base00: "transparent", // bg
      base0B: colors.string,
      base09: colors.number,
      base07: colors.text,
      base08: colors.null,
      base0D: colors.label,
      base03: text.secondary, // item string expanded
    },
    light: {
      base00: "transparent", // bg
      base0B: colors.string,
      base09: colors.number,
      base07: colors.text,
      base08: colors.null,
      base0D: colors.label,
      base03: text.secondary, // item string expanded
    },
  }[mode];
}
