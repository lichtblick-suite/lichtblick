/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import PieChartBuilder from "@lichtblick/suite-base/testing/builders/PieChartBuilder";

import { SUPPORTED_DATA_TYPES } from "./constants";
import type { PieChartConfig } from "./types";
import { useSettingsTree } from "./useSettingsTree";

describe("useSettingsTree", () => {
  function setup(
    configOverride: Partial<PieChartConfig> = {},
    legendCount = 3,
    error?: string,
    pathParseError?: string,
  ) {
    const config = PieChartBuilder.pieChartConfig(configOverride);
    return {
      props: { config, legendCount, error, pathParseError },
    };
  }

  it("should return general settings node with legends", () => {
    const { props } = setup({ path: "/foo", title: "My Pie Chart", legend1: "1", legend2: "2" }, 2);
    const { result } = renderHook(() => useSettingsTree(props));
    const { general } = result.current;

    expect(general?.fields?.path).toEqual({
      label: "Message path",
      input: "messagepath",
      value: props.config.path,
      error: undefined,
      validTypes: SUPPORTED_DATA_TYPES,
    });

    expect(general?.fields?.title).toEqual({
      label: "Title",
      input: "string",
      value: "My Pie Chart",
    });

    expect(general?.fields?.legend1).toEqual({
      label: "Legend 1",
      input: "string",
      value: "1",
    });

    expect(general?.fields?.legend2).toEqual({
      label: "Legend 2",
      input: "string",
      value: "2",
    });

    expect(general?.fields?.legendControls).toEqual({
      label: "Legend controls",
      input: "legendcontrols",
    });
  });

  it("should set pathParseError if provided", () => {
    const { props } = setup({}, 1, undefined, "invalid path");
    const { result } = renderHook(() => useSettingsTree(props));
    expect(result.current.general?.fields!.path!.error).toBe("invalid path");
  });

  it("should set error if provided", () => {
    const { props } = setup({}, 1, "config error");
    const { result } = renderHook(() => useSettingsTree(props));
    expect(result.current.general?.error).toBe("config error");
  });
});
