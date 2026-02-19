/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { StateTransitionConfig } from "@lichtblick/suite-base/panels/StateTransitions/types";

import useChartScalesAndBounds from "./useChartScalesAndBounds";

describe("useChartScalesAndBounds", () => {
  const config: StateTransitionConfig = {
    xAxisMinValue: undefined,
    xAxisMaxValue: undefined,
    xAxisRange: undefined,
    paths: [],
    isSynced: false,
  };

  it("should return correct yScale with given minY", () => {
    const { result } = renderHook(() => useChartScalesAndBounds(0, undefined, undefined, config));
    expect(result.current.yScale).toEqual({
      ticks: { display: false },
      grid: { display: false },
      type: "linear",
      min: 0,
      max: -3,
    });
  });

  it("should return correct xScale", () => {
    const { result } = renderHook(() =>
      useChartScalesAndBounds(undefined, undefined, undefined, config),
    );
    expect(result.current.xScale).toEqual({
      type: "linear",
      border: { display: false },
    });
  });

  it("should return correct databounds when xAxisRange is defined", () => {
    const customConfig = { ...config, xAxisRange: 100 };
    const { result } = renderHook(() =>
      useChartScalesAndBounds(undefined, 200, undefined, customConfig),
    );
    expect(result.current.databounds).toEqual({
      x: { min: 100, max: 200 },
      y: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    });
  });

  it("should return correct databounds when xAxisMinValue and xAxisMaxValue are defined", () => {
    const customConfig = { ...config, xAxisMinValue: 0, xAxisMaxValue: 500 };
    const { result } = renderHook(() =>
      useChartScalesAndBounds(undefined, undefined, 1000, customConfig),
    );
    expect(result.current.databounds).toEqual({
      x: { min: 0, max: 500 },
      y: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    });
  });

  it("should return correct databounds when endTimeSinceStart is defined", () => {
    const { result } = renderHook(() =>
      useChartScalesAndBounds(undefined, undefined, 1000, config),
    );
    expect(result.current.databounds).toEqual({
      x: { min: 0, max: 1000 },
      y: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    });
  });

  it("should return undefined databounds when endTimeSinceStart is undefined", () => {
    const { result } = renderHook(() =>
      useChartScalesAndBounds(undefined, undefined, undefined, config),
    );
    expect(result.current.databounds).toBeUndefined();
  });

  it("should return correct width and sizeRef", () => {
    const { result } = renderHook(() =>
      useChartScalesAndBounds(undefined, undefined, undefined, config),
    );
    expect(result.current.width).toBeUndefined();
    expect(result.current.sizeRef).toBeDefined();
  });
});
