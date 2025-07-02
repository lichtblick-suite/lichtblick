/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import PieChartBuilder from "@lichtblick/suite-base/testing/builders/PieChartBuilder";

import { useChartData } from "./useChartData";

describe("useChartData", () => {
  it("returns an empty array when rawValue is empty", () => {
    const rawValue = new Float32Array([]);
    const config = PieChartBuilder.pieChartConfig();
    const { result } = renderHook(() => useChartData(rawValue, config));
    expect(result.current).toEqual([]);
  });

  it("calculates percentages and assigns default names when legends are missing", () => {
    const rawValue = new Float32Array([10, 20, 30]);
    const config = PieChartBuilder.pieChartConfig();

    delete config.legend1;
    delete config.legend2;
    delete config.legend3;

    const { result } = renderHook(() => useChartData(rawValue, config));

    expect(result.current).toEqual([
      { name: "Data 1", value: 16.666666666666664, color: "hsl(200, 20%, 50%)" },
      { name: "Data 2", value: 33.33333333333333, color: "hsl(213.33333333333334, 20%, 45%)" },
      { name: "Data 3", value: 50, color: "hsl(226.66666666666666, 20%, 40%)" },
    ]);
  });

  it("uses legend names from config when provided", () => {
    const rawValue = new Float32Array([10, 20, 30]);
    const config = PieChartBuilder.pieChartConfig({
      legend1: "Legend A",
      legend2: "Legend B",
      legend3: "Legend C",
    });
    const { result } = renderHook(() => useChartData(rawValue, config));
    expect(result.current).toEqual([
      { name: "Legend A", value: 16.666666666666664, color: "hsl(200, 20%, 50%)" },
      { name: "Legend B", value: 33.33333333333333, color: "hsl(213.33333333333334, 20%, 45%)" },
      { name: "Legend C", value: 50, color: "hsl(226.66666666666666, 20%, 40%)" },
    ]);
  });

  it("trims legend names and assigns default names for empty legends", () => {
    const rawValue = new Float32Array([10, 20]);
    const config = PieChartBuilder.pieChartConfig({
      legend1: "  ",
      legend2: "Valid Legend",
    });
    const { result } = renderHook(() => useChartData(rawValue, config));
    expect(result.current).toEqual([
      { name: "Data 1", value: 33.33333333333333, color: "hsl(200, 20%, 50%)" },
      { name: "Valid Legend", value: 66.66666666666666, color: "hsl(220, 20%, 45%)" },
    ]);
  });

  it("handles a single data point correctly", () => {
    const rawValue = new Float32Array([100]);
    const config = PieChartBuilder.pieChartConfig({ legend1: "Single Data" });
    const { result } = renderHook(() => useChartData(rawValue, config));
    expect(result.current).toEqual([
      { name: "Single Data", value: 100, color: "hsl(200, 20%, 50%)" },
    ]);
  });
});
