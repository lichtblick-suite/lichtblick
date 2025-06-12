// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ChartOptions } from "chart.js";

import { fontMonospace } from "@lichtblick/theme";

import { getChartOptions } from "./getChartOptions";

describe("getChartOptions", () => {
  const mockDevicePixelRatio = 2;
  const mockGridColor = "#cccccc";
  const mockTickColor = "#666666";

  it("should return correct ChartOptions for scatter chart", () => {
    const options = getChartOptions({
      devicePixelRatio: mockDevicePixelRatio,
      gridColor: mockGridColor,
      tickColor: mockTickColor,
    });

    expect(options).toEqual<ChartOptions<"scatter">>({
      maintainAspectRatio: false,
      animation: false,
      elements: { line: { tension: 0 } },
      interaction: {
        intersect: false,
        mode: "x",
      },
      devicePixelRatio: mockDevicePixelRatio,
      font: {
        family: fontMonospace,
        size: 10,
      },
      responsive: false,
      scales: {
        x: {
          type: "linear",
          display: true,
          grid: {
            color: mockGridColor,
          },
          ticks: {
            font: {
              family: fontMonospace,
              size: 10,
            },
            color: mockTickColor,
            maxRotation: 0,
          },
        },
        y: {
          type: "linear",
          display: true,
          grid: {
            color: mockGridColor,
          },
          ticks: {
            font: {
              family: fontMonospace,
              size: 10,
            },
            color: mockTickColor,
            padding: 0,
            precision: 3,
          },
        },
      },
      plugins: {
        decimation: {
          enabled: false,
        },
        tooltip: {
          enabled: false,
        },
        zoom: {
          zoom: {
            enabled: true,
            mode: "x",
            sensitivity: 3,
            speed: 0.1,
          },
          pan: {
            mode: "xy",
            enabled: true,
            speed: 20,
            threshold: 10,
          },
        },
      },
    });
  });

  it("should set the correct devicePixelRatio", () => {
    const devicePixelRatio = 3;
    const options = getChartOptions({
      devicePixelRatio,
      gridColor: mockGridColor,
      tickColor: mockTickColor,
    });

    expect(options.devicePixelRatio).toBe(devicePixelRatio);
  });

  it("should set the correct grid and tick colors", () => {
    const gridColor = "#ffffff";
    const tickColor = "#000000";
    const options = getChartOptions({
      devicePixelRatio: mockDevicePixelRatio,
      gridColor,
      tickColor,
    });

    expect(options.scales?.x?.grid?.color).toBe(gridColor);
    expect(options.scales?.x?.ticks?.color).toBe(tickColor);
    expect(options.scales?.y?.grid?.color).toBe(gridColor);
    expect(options.scales?.y?.ticks?.color).toBe(tickColor);
  });

  it("should ensure plugins are configured correctly", () => {
    const options = getChartOptions({
      devicePixelRatio: mockDevicePixelRatio,
      gridColor: mockGridColor,
      tickColor: mockTickColor,
    });

    expect(options.plugins?.decimation?.enabled).toBe(false);
    expect(options.plugins?.tooltip?.enabled).toBe(false);
    expect(options.plugins?.zoom?.zoom?.enabled).toBe(true);
    expect(options.plugins?.zoom?.pan?.enabled).toBe(true);
  });
});
