/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  Chart,
  ChartData,
  ChartOptions,
  LinearScale,
  LineElement,
  PointElement,
  ScatterController,
} from "chart.js";

import { BasicBuilder } from "@lichtblick/test-builders";

import ChartJSManager from "./ChartJSManager";
import { RpcScales } from "../types";

// Jest resolves the plugin's UMD build, whose export is the plugin itself rather than `Zoom`.
jest.mock("@lichtblick/chartjs-plugin-zoom", () => ({
  Zoom: jest.requireActual("@lichtblick/chartjs-plugin-zoom"),
}));

Chart.register(LineElement, PointElement, ScatterController, LinearScale);

// Mirrors the datasets produced by the State Transitions panel (see messagesToDataset.ts).
function createStateTransitionsData(): ChartData<"scatter"> {
  const lineStyle = { borderWidth: 10, showLine: true, pointRadius: 0 };
  return {
    datasets: [
      { ...lineStyle, data: [] },
      {
        ...lineStyle,
        data: [
          { x: 1, y: -9 },
          { x: 5, y: -9 },
        ],
      },
    ],
  };
}

function createOptions(): ChartOptions {
  return {
    animation: false,
    maintainAspectRatio: false,
    scales: {
      x: { type: "linear", min: 0, max: 10 },
      y: {
        type: "linear",
        min: -11.25,
        max: -3,
        ticks: { display: false },
        grid: { display: false },
      },
    },
  };
}

async function createManager(): Promise<ChartJSManager> {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 100;

  const manager = new ChartJSManager({
    id: BasicBuilder.string(),
    node: { canvas },
    type: "scatter",
    data: createStateTransitionsData(),
    options: createOptions(),
    devicePixelRatio: 1,
    fontLoaded: Promise.resolve({ family: "monospace", status: "loaded" } as FontFace),
  });

  // The constructor starts init() asynchronously, wait for it to create the chart.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return manager;
}

// The plot area's four edges: x pixelMin/pixelMax are left/right, y pixelMin/pixelMax are bottom/top.
function getPlotAreaEdges(scales: RpcScales): number[] {
  const { x, y } = scales;
  if (x == undefined || y == undefined) {
    throw new Error("Expected the update to return both scales");
  }
  return [x.pixelMin, x.pixelMax, y.pixelMin, y.pixelMax];
}

describe("ChartJSManager", () => {
  let manager: ChartJSManager | undefined;

  afterEach(() => {
    manager?.destroy();
    manager = undefined;
  });

  describe("update", () => {
    it("should keep the plot area in place when new datasets follow an options-only update", async () => {
      // Given
      manager = await createManager();

      // When
      const afterOptionsUpdate = manager.update({
        options: createOptions(),
        isBoundsReset: false,
      });
      const afterDataUpdate = manager.update({
        data: createStateTransitionsData(),
        isBoundsReset: false,
      });

      // Then
      expect(getPlotAreaEdges(afterDataUpdate)).toEqual(getPlotAreaEdges(afterOptionsUpdate));
    });
  });
});
