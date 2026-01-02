// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { PanelExtensionContext, SettingsTreeAction } from "@lichtblick/suite";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

export enum ColorMapConfig {
  RED_YELLOW_GREEN = "red-yellow-green",
  RAINBOW = "rainbow",
  TURBO = "turbo",
}

export enum ColorModeConfig {
  COLORMAP = "colormap",
  GRADIENT = "gradient",
}

export type GaugeConfig = {
  colorMap: ColorMapConfig;
  colorMode: ColorModeConfig;
  gradient: [string, string];
  maxValue: number;
  minValue: number;
  path: string;
  reverse: boolean;
};

export type ColorStops = {
  color: string;
  location: number;
};

export type GaugePanelAdapterProps = {
  config: GaugeConfig;
  saveConfig: SaveConfig<GaugeConfig>;
};

export type GaugeProps = {
  context: PanelExtensionContext;
};

export type BuildConicGradientProps = {
  config: Pick<GaugeConfig, "colorMap" | "colorMode" | "gradient" | "reverse">;
  gaugeAngle: number;
  height: number;
  width: number;
};

export type SettingsActionReducerProps = {
  prevConfig: GaugeConfig;
  action: SettingsTreeAction;
};

export type SettingsTreeNodesProps = {
  config: GaugeConfig;
  pathParseError: string | undefined;
  error: string | undefined;
};
