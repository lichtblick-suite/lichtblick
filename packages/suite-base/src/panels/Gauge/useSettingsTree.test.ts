/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { renderHook } from "@testing-library/react";

import GaugeBuilder from "@lichtblick/suite-base/testing/builders/GaugeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { ColorMapConfig, ColorModeConfig, SettingsTreeNodesProps } from "./types";
import { useSettingsTree } from "./useSettingsTree";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("useSettingsTree", () => {
  function setup(propsOverride: Partial<SettingsTreeNodesProps> = {}): {
    props: SettingsTreeNodesProps;
  } {
    const props: SettingsTreeNodesProps = {
      config: GaugeBuilder.config(),
      error: undefined,
      pathParseError: undefined,
      ...propsOverride,
    };
    return { props };
  }

  it("should return general settings node", () => {
    const { props } = setup({
      config: GaugeBuilder.config({
        colorMap: ColorMapConfig.RAINBOW,
        colorMode: ColorModeConfig.COLORMAP,
      }),
    });

    const { result } = renderHook(() => useSettingsTree(props));
    const { general } = result.current;

    expect(general).toBeDefined();
    expect(general.fields!.path).toEqual({
      label: "messagePath.label",
      input: "messagepath",
      value: props.config.path,
      error: props.pathParseError,
      validTypes: expect.any(Array),
    });
    expect(general.fields!.minValue).toEqual({
      label: "minValue.label",
      input: "number",
      value: props.config.minValue,
    });
    expect(general.fields!.maxValue).toEqual({
      label: "maxValue.label",
      input: "number",
      value: props.config.maxValue,
    });
    expect(general.fields!.colorMode).toEqual({
      label: "colorMode.label",
      input: "select",
      value: props.config.colorMode,
      options: expect.any(Array),
    });
    expect(general.fields!.colorMap).toBeDefined();
  });

  it("should include gradient field when colorMode is GRADIENT", () => {
    const { props } = setup({
      config: GaugeBuilder.config({
        colorMap: ColorMapConfig.RAINBOW,
        colorMode: ColorModeConfig.GRADIENT,
      }),
    });

    const { result } = renderHook(() => useSettingsTree(props));
    const { general } = result.current;

    expect(general.fields!.gradient).toEqual({
      label: "colorMode.options.gradient",
      input: props.config.colorMode,
      value: props.config.gradient,
    });
    expect(general.fields!.colorMap).toBeUndefined();
  });

  it("should include reverse field", () => {
    const { props } = setup({
      config: GaugeBuilder.config({
        reverse: true,
      }),
    });

    const { result } = renderHook(() => useSettingsTree(props));
    const { general } = result.current;

    expect(general.fields!.reverse).toEqual({
      label: "reverse.label",
      input: "boolean",
      value: props.config.reverse,
    });
  });

  it("should set error when provided", () => {
    const { props } = setup({
      config: GaugeBuilder.config(),
      error: BasicBuilder.string(),
    });

    const { result } = renderHook(() => useSettingsTree(props));
    const { general } = result.current;

    expect(general.error).toEqual(props.error);
  });

  it("should set pathParseError when provided", () => {
    const { props } = setup({
      config: GaugeBuilder.config(),
      pathParseError: BasicBuilder.string(),
    });

    const { result } = renderHook(() => useSettingsTree(props));
    const { general } = result.current;

    expect(general.fields!.path!.error).toEqual(props.pathParseError);
  });
});
