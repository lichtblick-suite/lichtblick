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

import { RpcScales, TypedChartData } from "@lichtblick/suite-base/components/Chart/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import ChartJSManager, { InitOpts } from "./ChartJSManager";
import { lineSegmentLabelColor } from "./lineSegments";

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

function createOptions(overrides: Partial<ChartOptions> = {}): ChartOptions {
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
    ...overrides,
  };
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 100;
const BOUNDING_RECT = { left: 0, top: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT } as DOMRect;

const managers: ChartJSManager[] = [];

function buildManager(overrides: Partial<InitOpts> = {}): ChartJSManager {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const manager = new ChartJSManager({
    id: BasicBuilder.string(),
    node: { canvas },
    type: "scatter",
    data: createStateTransitionsData(),
    options: createOptions(),
    devicePixelRatio: 1,
    fontLoaded: Promise.resolve({ family: "monospace", status: "loaded" } as FontFace),
    ...overrides,
  });
  managers.push(manager);
  return manager;
}

async function createManager(overrides: Partial<InitOpts> = {}): Promise<ChartJSManager> {
  const manager = buildManager(overrides);
  // The constructor starts init() asynchronously, wait for it to create the chart.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return manager;
}

function requireScales(scales: RpcScales): Required<RpcScales> {
  const { x, y } = scales;
  if (x == undefined || y == undefined) {
    throw new Error("Expected both scales");
  }
  return { x, y };
}

// The plot area's four edges: x pixelMin/pixelMax are left/right, y pixelMin/pixelMax are bottom/top.
function getPlotAreaEdges(scales: RpcScales): number[] {
  const { x, y } = requireScales(scales);
  return [x.pixelMin, x.pixelMax, y.pixelMin, y.pixelMax];
}

function toPixel(scales: RpcScales, point: { x: number; y: number }): { x: number; y: number } {
  const { x, y } = requireScales(scales);
  return {
    x: x.pixelMin + ((point.x - x.min) / (x.max - x.min)) * (x.pixelMax - x.pixelMin),
    y: y.pixelMin + ((point.y - y.min) / (y.max - y.min)) * (y.pixelMax - y.pixelMin),
  };
}

// The manager receives plain objects over RPC, not real DOM or Hammer events.
function makeRpcEvent<T>(props: Record<string, unknown>): T {
  return { cancelable: false, target: { boundingClientRect: BOUNDING_RECT }, ...props } as T;
}

describe("ChartJSManager", () => {
  afterEach(() => {
    for (const manager of managers.splice(0)) {
      manager.destroy();
    }
  });

  describe("init", () => {
    it("should color line segments by label when initialized with datasets", async () => {
      // Given
      const data = createStateTransitionsData();

      // When
      await createManager({ data });

      // Then
      expect(data.datasets[1]?.segment).toEqual({ borderColor: lineSegmentLabelColor });
    });

    it("should keep the layout padding when the options define one", async () => {
      // Given
      const padding = 20;
      const unpadded = await createManager();
      const padded = await createManager({
        options: createOptions({ layout: { padding: { left: padding } } }),
      });

      // When
      const unpaddedScales = requireScales(unpadded.getScales());
      const paddedScales = requireScales(padded.getScales());

      // Then
      expect(paddedScales.x.pixelMin).toBe(unpaddedScales.x.pixelMin + padding);
    });
  });

  describe("update", () => {
    it("should return no scales when the chart is not initialized yet", () => {
      // Given
      const manager = buildManager({ fontLoaded: new Promise<FontFace>(() => {}) });

      // When
      const scales = manager.update({ options: createOptions(), isBoundsReset: false });

      // Then
      expect(scales).toEqual({});
    });

    it("should keep the plot area in place when new datasets follow an options-only update", async () => {
      // Given
      const manager = await createManager();

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

    it("should keep the plot area in place when an options-only update follows new datasets", async () => {
      // Given
      const manager = await createManager();

      // When
      const afterDataUpdate = manager.update({
        data: createStateTransitionsData(),
        isBoundsReset: false,
      });
      const afterOptionsUpdate = manager.update({
        options: createOptions(),
        isBoundsReset: false,
      });

      // Then
      expect(getPlotAreaEdges(afterOptionsUpdate)).toEqual(getPlotAreaEdges(afterDataUpdate));
    });

    it("should color line segments by label when updated with datasets", async () => {
      // Given
      const manager = await createManager();
      const data = createStateTransitionsData();

      // When
      manager.update({ data, isBoundsReset: false });

      // Then
      expect(data.datasets[1]?.segment).toEqual({ borderColor: lineSegmentLabelColor });
    });

    it.each([
      { width: 600, height: 200 },
      { width: 600.9, height: 200.9 },
    ])("should resize the plot area to whole pixels when the size changes to $width x $height", async ({
      width,
      height,
    }) => {
      // Given
      const manager = await createManager();
      const before = requireScales(manager.getScales());

      // When
      const after = requireScales(manager.update({ width, height, isBoundsReset: false }));

      // Then
      expect([after.x.pixelMax, after.y.pixelMin]).toEqual([
        before.x.pixelMax + 200,
        before.y.pixelMin + 100,
      ]);
    });

    it("should only change the height when no width is given", async () => {
      // Given
      const manager = await createManager();
      const before = requireScales(manager.getScales());

      // When
      const after = requireScales(
        manager.update({ height: CANVAS_HEIGHT + 100, isBoundsReset: false }),
      );

      // Then
      expect([after.x.pixelMax, after.y.pixelMin]).toEqual([
        before.x.pixelMax,
        before.y.pixelMin + 100,
      ]);
    });

    it("should keep the plot area when the size is unchanged", async () => {
      // Given
      const manager = await createManager();
      const before = manager.getScales();

      // When
      const after = manager.update({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        isBoundsReset: false,
      });

      // Then
      expect(getPlotAreaEdges(after)).toEqual(getPlotAreaEdges(before));
    });

    it.each([
      true,
      false,
    ])("should apply an explicit x range when isBoundsReset is %s", async (isBoundsReset) => {
      // Given
      const manager = await createManager();
      const options = createOptions();
      options.scales!.x = { type: "linear", min: 2, max: 8 };

      // When
      const { x } = requireScales(manager.update({ options, isBoundsReset }));

      // Then
      expect([x.min, x.max]).toEqual([2, 8]);
    });

    it("should keep the current scales when bounds are not reset and no range is given", async () => {
      // Given
      const manager = await createManager();
      const options = { ...createOptions(), scales: undefined };

      // When
      const { x } = requireScales(manager.update({ options, isBoundsReset: false }));

      // Then
      expect([x.min, x.max]).toEqual([0, 10]);
    });

    it("should fit the x scale to typed data when bounds are reset", async () => {
      // Given
      const manager = await createManager();
      const options = createOptions();
      options.scales!.x = { type: "linear" };
      const typedData: TypedChartData = {
        datasets: [
          {
            data: [
              {
                x: new Float32Array([2, 6]),
                y: new Float32Array([-9, -9]),
                value: ["off", "on"],
              },
            ],
          },
        ],
      };

      // When
      const { x } = requireScales(manager.update({ options, typedData, isBoundsReset: true }));

      // Then
      expect([x.min, x.max]).toEqual([2, 6]);
    });
  });

  describe("pointer events", () => {
    it.each([
      "panstart",
      "panmove",
      "panend",
    ] as const)("should return no scales from %s when the chart is not initialized yet", (method) => {
      // Given
      const manager = buildManager({ fontLoaded: new Promise<FontFace>(() => {}) });

      // When
      const scales = manager[method](makeRpcEvent({ deltaX: 0, deltaY: 0 }));

      // Then
      expect(scales).toEqual({});
    });

    it.each([
      "wheel",
      "mousedown",
      "mousemove",
      "mouseup",
    ] as const)("should use the bounding rect sent over RPC when handling %s", async (method) => {
      // Given
      const manager = await createManager();
      const event = makeRpcEvent<WheelEvent>({ clientX: 0, clientY: 0 });

      // When
      manager[method](event);

      // Then
      expect((event.target as Element).getBoundingClientRect()).toBe(BOUNDING_RECT);
    });

    it("should zoom into the x axis when the wheel turns with zoom enabled", async () => {
      // Given
      const manager = await createManager({
        options: createOptions({ plugins: { zoom: { zoom: { enabled: true, mode: "x" } } } }),
      });
      const center = toPixel(manager.getScales(), { x: 5, y: -9 });

      // When
      const { x } = requireScales(
        manager.wheel(makeRpcEvent({ deltaY: -100, clientX: center.x, clientY: center.y })),
      );

      // Then
      expect(x.max - x.min).toBeLessThan(10);
    });

    it("should pan the x axis when dragged with pan enabled", async () => {
      // Given
      const manager = await createManager({
        options: createOptions({ plugins: { zoom: { pan: { enabled: true, mode: "x" } } } }),
      });
      manager.panstart(makeRpcEvent({ center: { x: 200, y: 50 }, deltaX: 0, deltaY: 0 }));

      // When
      const { x } = requireScales(manager.panmove(makeRpcEvent({ deltaX: 50, deltaY: 0 })));

      // Then
      expect(x.min).toBeLessThan(0);
    });

    it("should stop panning when the drag ends", async () => {
      // Given
      const manager = await createManager({
        options: createOptions({ plugins: { zoom: { pan: { enabled: true, mode: "x" } } } }),
      });
      manager.panstart(makeRpcEvent({ center: { x: 200, y: 50 }, deltaX: 0, deltaY: 0 }));
      const afterPanEnd = manager.panend(makeRpcEvent({ deltaX: 0, deltaY: 0 }));

      // When
      const afterMove = manager.panmove(makeRpcEvent({ deltaX: 50, deltaY: 0 }));

      // Then
      expect(afterMove).toEqual(afterPanEnd);
    });
  });

  describe("getElementsAtEvent", () => {
    it("should return no elements when the chart is not initialized yet", () => {
      // Given
      const manager = buildManager({ fontLoaded: new Promise<FontFace>(() => {}) });

      // When
      const elements = manager.getElementsAtEvent({
        event: { clientX: 0, clientY: 0 } as MouseEvent,
      });

      // Then
      expect(elements).toEqual([]);
    });

    it("should sort the points by distance when several are under the cursor", async () => {
      // Given
      const manager = await createManager({
        data: {
          datasets: [{ data: [{ x: 5, y: -5 }] }, { data: [{ x: 5, y: -9 }] }],
        },
        options: createOptions({ interaction: { mode: "x", intersect: false } }),
      });
      const cursor = toPixel(manager.getScales(), { x: 5, y: -9 });

      // When
      const elements = manager.getElementsAtEvent({
        event: { clientX: cursor.x, clientY: cursor.y } as MouseEvent,
      });

      // Then
      expect(elements.map(({ datasetIndex }) => datasetIndex)).toEqual([1, 0]);
    });

    it("should return the last point before the cursor when the mode is lastX", async () => {
      // Given
      const manager = await createManager({
        options: createOptions({ interaction: { mode: "lastX", intersect: false } }),
      });
      const cursor = toPixel(manager.getScales(), { x: 3, y: -9 });

      // When
      const elements = manager.getElementsAtEvent({
        event: { clientX: cursor.x, clientY: cursor.y } as MouseEvent,
      });

      // Then
      expect(elements.map(({ data }) => data)).toEqual([{ x: 1, y: -9 }]);
    });
  });

  describe("getDatalabelAtEvent", () => {
    it("should return nothing when no label was clicked", async () => {
      // Given
      const manager = await createManager();

      // When
      const datum = manager.getDatalabelAtEvent({ event: new Event("click") });

      // Then
      expect(datum).toBeUndefined();
    });

    it("should return the datum when a label is clicked", async () => {
      // Given
      const point = { x: 5, y: -9, label: BasicBuilder.string(), labelColor: "red" };
      const manager = await createManager({
        data: { datasets: [{ data: [point] }, { data: [{ x: 1, y: -5 }] }] },
        options: createOptions({ plugins: { datalabels: { display: true } } }),
      });
      const cursor = toPixel(manager.getScales(), point);

      // When
      const datum = manager.getDatalabelAtEvent({
        event: { type: "click", x: cursor.x, y: cursor.y } as unknown as Event,
      });

      // Then
      expect(datum).toBe(point);
    });
  });

  describe("getScales", () => {
    it("should return no scales when the chart is not initialized yet", () => {
      // Given
      const manager = buildManager({ fontLoaded: new Promise<FontFace>(() => {}) });

      // When
      const scales = manager.getScales();

      // Then
      expect(scales).toEqual({});
    });
  });
});
