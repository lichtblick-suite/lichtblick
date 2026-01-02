// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { COLOR_MAPS } from "@lichtblick/suite-base/panels/Gauge/constants";
import {
  BuildConicGradientProps,
  ColorMapConfig,
  ColorModeConfig,
  GaugeConfig,
} from "@lichtblick/suite-base/panels/Gauge/types";
import { turboColorString } from "@lichtblick/suite-base/util/colorUtils";

import { buildConicGradient } from "./buildConicGradient";

type ConicGradientConfig = Pick<GaugeConfig, "colorMap" | "colorMode" | "gradient" | "reverse">;

describe("buildConicGradient", () => {
  function setup(
    configOverride: Partial<ConicGradientConfig> = {},
    propsOverride: Partial<BuildConicGradientProps> = {},
  ): {
    props: BuildConicGradientProps;
  } {
    const config: ConicGradientConfig = {
      colorMap: ColorMapConfig.RAINBOW,
      colorMode: ColorModeConfig.COLORMAP,
      gradient: ["#000000", "#FFFFFF"],
      reverse: false,
      ...configOverride,
    };

    const props: BuildConicGradientProps = {
      height: 100,
      width: 200,
      gaugeAngle: Math.PI / 4,
      config: config as GaugeConfig,
      ...propsOverride,
    };
    return { props };
  }

  it.each([ColorMapConfig.RED_YELLOW_GREEN, ColorMapConfig.RAINBOW])(
    "should generate a gradient for the RED_YELLOW_GREEN and RAINBOW colormaps",
    (colorMap) => {
      const { props } = setup({ colorMap });
      const colorStops = COLOR_MAPS[colorMap];

      const result = buildConicGradient(props);

      colorStops.forEach((colorStop) => {
        expect(result).toContain(colorStop.color);
      });
    },
  );

  it("should generate a gradient for the TURBO colormap", () => {
    const colorMap = ColorMapConfig.TURBO;
    const { props } = setup({ colorMap });
    const result = buildConicGradient(props);

    const numStops = 20;
    const expectedColors = Array.from({ length: numStops }, (_, i) =>
      turboColorString(i / (numStops - 1)),
    );

    expectedColors.forEach((color) => {
      expect(result).toContain(color);
    });
  });

  it("should generate a gradient for the GRADIENT color mode", () => {
    const gradient: [string, string] = ["#FF0000", "#00FF00"];
    const { props } = setup({
      colorMode: ColorModeConfig.GRADIENT,
      gradient,
    });

    const result = buildConicGradient(props);

    expect(result).toContain(gradient[0]);
    expect(result).toContain(gradient[1]);
  });

  it("should reverse the gradient when reverse is true", () => {
    const { props } = setup({
      colorMode: ColorModeConfig.GRADIENT,
      reverse: true,
    });

    const result = buildConicGradient(props);

    expect(result).toContain(`${props.config.gradient[1]} 0rad`);
    expect(result).toContain(props.config.gradient[0]);
  });

  it("should handle empty color stops gracefully", () => {
    const { props } = setup({
      colorMode: "INVALID_MODE" as ColorModeConfig,
    });

    const result = buildConicGradient(props);

    expect(result).toContain("conic-gradient");
    expect(result).toContain("transparent");
  });

  it("should calculate correct starting angle", () => {
    const { props } = setup();
    const expectedAngle = -Math.PI / 2 + props.gaugeAngle;

    const result = buildConicGradient(props);

    expect(result).toContain(`from ${expectedAngle}rad`);
  });
});
