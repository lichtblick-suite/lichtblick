// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  ColorMapConfig,
  ColorModeConfig,
  GaugeConfig,
} from "@lichtblick/suite-base/panels/Gauge/types";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

export default class GaugeBuilder {
  public static config(props: Partial<GaugeConfig> = {}): GaugeConfig {
    return defaults<GaugeConfig>(props, {
      colorMap: BasicBuilder.sample(ColorMapConfig),
      colorMode: BasicBuilder.sample(ColorModeConfig),
      gradient: ["#000", "#fff"],
      maxValue: BasicBuilder.number(),
      minValue: BasicBuilder.number(),
      path: BasicBuilder.string(),
      reverse: BasicBuilder.boolean(),
    });
  }
}
