// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export const keyMap: Record<string, string> = { urls: "url" };
export const DEFAULT_STUDIO_SCRIPT_PREFIX = "/studio_script/";
// JSON Tree theme colors - reusable across components

export const JSON_TREE_THEME_COLORS = {
  dark: {
    string: "#ffa657", // base0B - string & date, item string
    number: "#7ee787", // base09 - number & boolean
    text: "#79c0ff", // base07 - text
    null: "#ff7b72", // base08 - null, undefined, function, & symbol
    label: "#79c0ff", // base0D - label & arrow
  },
  light: {
    string: "#953800", // base0B - string & date, item string
    number: "#116329", // base09 - number & boolean
    text: "#0550ae", // base07 - text
    null: "#cf222e", // base08 - null, undefined, function, & symbol
    label: "#0550ae", // base0D - label & arrow
  },
} as const;
export const TAB_PANEL_TYPE = "Tab";
