// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  ColorMapConfig,
  ColorModeConfig,
  ColorStops,
  GaugeConfig,
} from "@lichtblick/suite-base/panels/Gauge/types";

export const DATA_TYPES = [
  "float32",
  "float64",
  "int16",
  "int32",
  "int8",
  "string",
  "uint16",
  "uint32",
  "uint8",
];

export const DEFAULT_CONFIG: GaugeConfig = {
  colorMap: ColorMapConfig.RED_YELLOW_GREEN,
  colorMode: ColorModeConfig.COLORMAP,
  gradient: ["#0000ff", "#ff00ff"],
  maxValue: 1,
  minValue: 0,
  path: "",
  reverse: false,
};

export const COLOR_MAPS: Record<ColorMapConfig | ColorModeConfig, ColorStops[]> = {
  [ColorMapConfig.RED_YELLOW_GREEN]: [
    { color: "#f00", location: 0 },
    { color: "#ff0", location: 0.5 },
    { color: "#0c0", location: 1 },
  ],
  [ColorMapConfig.RAINBOW]: [
    { color: "#f0f", location: 0 },
    { color: "#00f", location: 1 / 5 },
    { color: "#0ff", location: 2 / 5 },
    { color: "#0f0", location: 3 / 5 },
    { color: "#ff0", location: 4 / 5 },
    { color: "#f00", location: 1 },
  ],
  [ColorMapConfig.TURBO]: [],
  [ColorModeConfig.COLORMAP]: [],
  [ColorModeConfig.GRADIENT]: [],
};
