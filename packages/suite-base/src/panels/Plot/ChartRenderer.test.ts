// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { Chart, ChartOptions, Element, InteractionItem, Scale } from "chart.js";

import { Zoom as ZoomPlugin } from "@lichtblick/chartjs-plugin-zoom";
import { Immutable } from "@lichtblick/suite";
import { ChartRenderer } from "@lichtblick/suite-base/panels/Plot/ChartRenderer";
import { DEFAULT_ANNOTATION } from "@lichtblick/suite-base/panels/Plot/constants";
import { getChartOptions } from "@lichtblick/suite-base/panels/Plot/utils/getChartOptions";
import { BasicBuilder } from "@lichtblick/test-builders";

import {
  ChartOptionsPlot,
  ChartRendererProps,
  ChartType,
  Dataset,
  PanEndInteractionEvent,
  PanMoveInteractionEvent,
  PanStartInteractionEvent,
  ReferenceLine,
  UpdateAction,
  WheelInteractionEvent,
} from "./types";

const OPTIONS_CHART: ChartOptionsPlot = {
  devicePixelRatio: 2,
  gridColor: "#ccc",
  tickColor: "#000",
};

const SCALES_CHART: Record<string, Partial<Scale>> = {
  x: { min: 0, max: 100 },
  y: { min: 0, max: 100 },
};

jest.mock("chart.js", () => {
  const canvas = { width: 0, height: 0 };
  const options: ChartOptions = {
    scales: {
      x: {
        ticks: {
          color: OPTIONS_CHART.tickColor,
        },
      },
      y: {
        ticks: {
          color: OPTIONS_CHART.tickColor,
        },
      },
    },
    plugins: {},
    interaction: {},
  };

  return {
    Chart: jest.fn().mockImplementation(() => ({
      update: jest.fn(),
      resize: jest.fn(),
      data: { datasets: [] },
      options,
      scales: SCALES_CHART,
      canvas,
      $zoom: {
        panStartHandler: jest.fn(),
        panHandler: jest.fn(),
        panEndHandler: jest.fn(),
      },
      getElementsAtEventForMode: jest.fn().mockReturnValue([]),
    })),
  };
});

jest.mock("@lichtblick/chartjs-plugin-zoom", () => ({
  Zoom: {
    start: jest.fn(),
  },
}));

jest.mock("@lichtblick/suite-base/panels/Plot/utils/getChartOptions", () => ({
  getChartOptions: jest.fn().mockReturnValue({}),
}));

global.OffscreenCanvas = class {
  public width: number;
  public height: number;

  public constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public getContext() {
    return {};
  }
} as unknown as typeof OffscreenCanvas;

type ChartRendererTestSetup = {
  actionOverride?: Partial<UpdateAction>;
};

describe("ChartRenderer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  function setup({ actionOverride }: ChartRendererTestSetup = {}) {
    const canvas = new OffscreenCanvas(500, 500);
    const props: ChartRendererProps = {
      canvas,
      ...OPTIONS_CHART,
    };

    const action: Immutable<UpdateAction> = {
      type: "update",
      ...actionOverride,
    };

    const chartOptions = {
      scales: {
        x: { ticks: { tickColor: props.tickColor } },
        y: { ticks: { tickColor: props.tickColor } },
      },
    };
    (getChartOptions as jest.Mock).mockReturnValue(chartOptions);

    const chartRenderer = new ChartRenderer(props);

    return {
      canvas,
      props,
      chartRenderer,
      action,
      chartOptions,
    };
  }

  describe("constructor", () => {
    it("should initialize a Chart instance with correct chart options", () => {
      const { props } = setup();

      expect(Chart).toHaveBeenCalledWith(expect.anything(), {
        data: { datasets: [] },
        options: expect.any(Object),
        plugins: [ZoomPlugin],
        type: "scatter",
      });
      expect(getChartOptions).toHaveBeenCalledWith({
        devicePixelRatio: props.devicePixelRatio,
        gridColor: props.gridColor,
        tickColor: props.tickColor,
      });
    });
  });

  describe("update", () => {
    it("should update chart dimensions on update action", () => {
      const { action, chartRenderer } = setup({
        actionOverride: {
          size: {
            width: BasicBuilder.number({ min: 800, max: 3840 }),
            height: BasicBuilder.number({ min: 600, max: 2160 }),
          },
        },
      });

      chartRenderer.update(action);
      const chartInstance = (chartRenderer as any).getChartInstance();
      const resizeSpy = jest.spyOn(chartInstance, "resize");

      expect(chartInstance.canvas.width).toBe(action.size?.width);
      expect(chartInstance.canvas.height).toBe(action.size?.height);
      expect(resizeSpy).toHaveBeenCalledTimes(1);
    });

    it("should update chart scales on update action", () => {
      const { action, chartRenderer } = setup({
        actionOverride: {
          xBounds: {
            min: BasicBuilder.number({ min: 0, max: 100 }),
            max: BasicBuilder.number({ min: 101, max: 200 }),
          },
          yBounds: {
            min: BasicBuilder.number({ min: 0, max: 100 }),
            max: BasicBuilder.number({ min: 101, max: 200 }),
          },
        },
      });

      chartRenderer.update(action);
      const chartInstance: ChartType = (chartRenderer as any).getChartInstance();

      expect(chartInstance.options.scales!.x!.min).toBe(action.xBounds!.min);
      expect(chartInstance.options.scales!.x!.max).toBe(action.xBounds!.max);
      expect(chartInstance.options.scales!.y!.min).toBe(action.yBounds!.min);
      expect(chartInstance.options.scales!.y!.max).toBe(action.yBounds!.max);
    });

    it("should display x-axis labels when enabled in update action", () => {
      const { action, chartRenderer } = setup({
        actionOverride: {
          showXAxisLabels: true,
        },
      });

      chartRenderer.update(action);
      const chartInstance: ChartType = (chartRenderer as any).getChartInstance();

      expect(chartInstance.options.scales!.x!.ticks?.display).toBe(true);
    });

    it("should display y-axis labels when enabled in update action", () => {
      const { action, chartRenderer } = setup({
        actionOverride: {
          showYAxisLabels: true,
        },
      });

      chartRenderer.update(action);
      const chartInstance: ChartType = (chartRenderer as any).getChartInstance();

      expect(chartInstance.options.scales!.y!.ticks?.display).toBe(true);
    });

    it("should update chart on update action", () => {
      const { action, chartRenderer } = setup();

      chartRenderer.update(action);
      const chartInstance = (chartRenderer as any).getChartInstance();
      const updateSpy = jest.spyOn(chartInstance, "update");

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith("none");
    });

    it("should update returns x and y scales", () => {
      const { action, chartRenderer } = setup();

      const chartUpdated = chartRenderer.update(action);

      expect(chartUpdated?.x.min).toBe(SCALES_CHART.x!.min!);
      expect(chartUpdated?.x.max).toBe(SCALES_CHART.x!.max!);
      expect(chartUpdated?.y.min).toBe(SCALES_CHART.y!.min!);
      expect(chartUpdated?.y.max).toBe(SCALES_CHART.y!.max!);
    });

    it("should update returns undefined", () => {
      (Chart as unknown as jest.Mock).mockImplementationOnce(() => ({
        update: jest.fn(),
        scales: {
          x: undefined,
          y: undefined,
        },
      }));
      const { action, chartRenderer } = setup();

      const chartUpdated = chartRenderer.update(action);

      expect(chartUpdated).toBeUndefined();
    });

    it("should update when wheel event type", () => {
      const wheelEvent = {
        type: "wheel",
        boundingClientRect: {},
        deltaX: BasicBuilder.number(),
        deltaY: BasicBuilder.number(),
      } as WheelInteractionEvent;
      const { action, chartRenderer } = setup({
        actionOverride: {
          type: "update",
          interactionEvents: [wheelEvent],
        },
      });
      const fakeNodeEventsEmitSpy = jest.spyOn((chartRenderer as any).getFakeNodeEvents(), "emit");

      chartRenderer.update(action);

      expect(fakeNodeEventsEmitSpy).toHaveBeenCalledWith("wheel", {
        deltaX: wheelEvent.deltaX,
        deltaY: wheelEvent.deltaY,
        target: expect.objectContaining({
          getBoundingClientRect: expect.any(Function),
        }),
      });
    });

    it("should update when panstart event type", () => {
      const panStartEvent = {
        type: "panstart",
        boundingClientRect: {},
        center: { x: BasicBuilder.number(), y: BasicBuilder.number() },
      } as PanStartInteractionEvent;
      const { action, chartRenderer } = setup({
        actionOverride: {
          type: "update",
          interactionEvents: [panStartEvent],
        },
      });
      const chartInstance = (chartRenderer as any).getChartInstance();
      const panStartHandlerSpy = jest.spyOn(chartInstance.$zoom, "panStartHandler");

      chartRenderer.update(action);

      expect(panStartHandlerSpy).toHaveBeenCalledWith({
        center: panStartEvent.center,
        deltaX: undefined,
        deltaY: undefined,
        target: expect.objectContaining({
          getBoundingClientRect: expect.any(Function),
        }),
      });
    });

    it("should update when panmove event type", () => {
      const panMoveEvent = {
        type: "panmove",
      } as PanMoveInteractionEvent;
      const { action, chartRenderer } = setup({
        actionOverride: {
          type: "update",
          interactionEvents: [panMoveEvent],
        },
      });
      const chartInstance = (chartRenderer as any).getChartInstance();
      const panHandlerSpy = jest.spyOn(chartInstance.$zoom, "panHandler");

      chartRenderer.update(action);

      expect(panHandlerSpy).toHaveBeenCalledWith(panMoveEvent);
    });

    it("should update when panend event type", () => {
      const panEndEvent = {
        type: "panend",
      } as PanEndInteractionEvent;
      const { action, chartRenderer } = setup({
        actionOverride: {
          type: "update",
          interactionEvents: [panEndEvent],
        },
      });
      const chartInstance = (chartRenderer as any).getChartInstance();
      const panHandlerSpy = jest.spyOn(chartInstance.$zoom, "panEndHandler");

      chartRenderer.update(action);

      expect(panHandlerSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle reference lines in update action", () => {
      (Chart as unknown as jest.Mock).mockImplementationOnce(() => ({
        update: jest.fn(),
        scales: SCALES_CHART,
        options: {
          plugins: {
            annotation: {
              annotations: [{}],
            },
          },
        } as ChartOptions,
      }));
      const referenceLines: ReferenceLine[] = [
        { value: BasicBuilder.number(), color: BasicBuilder.string() },
        { value: BasicBuilder.number(), color: BasicBuilder.string() },
      ];
      const { chartRenderer, action } = setup({
        actionOverride: { referenceLines },
      });
      const chartInstance = (chartRenderer as any).getChartInstance();

      chartRenderer.update(action);

      const newAnnotations = chartInstance.options.plugins?.annotation?.annotations;
      expect(newAnnotations).toEqual([
        {
          ...DEFAULT_ANNOTATION,
          borderColor: referenceLines[0]?.color,
          value: referenceLines[0]?.value,
        },
        {
          ...DEFAULT_ANNOTATION,
          borderColor: referenceLines[1]?.color,
          value: referenceLines[1]?.value,
        },
      ]);
    });
  });

  describe("getElementsAtPixel", () => {
    it("should return elements sorted by proximity to a pixel", () => {
      const { chartRenderer } = setup();
      const chartInstance = (chartRenderer as any).getChartInstance();
      const elementsAtEventMock: InteractionItem[] = [
        { element: { x: 10, y: 10 } as Element, datasetIndex: 0, index: 0 },
        { element: { x: 30, y: 30 } as Element, datasetIndex: 1, index: 1 },
        { element: { x: 20, y: 20 } as Element, datasetIndex: 2, index: 2 },
      ];

      (chartInstance.getElementsAtEventForMode as jest.Mock).mockReturnValue(elementsAtEventMock);
      chartInstance.data.datasets = [
        {
          data: [{ x: 10, y: 10 }],
        },
        {
          data: [
            { x: 20, y: 20 },
            { x: 60, y: 60 },
          ],
        },
      ];

      const elements = chartRenderer.getElementsAtPixel({ x: 1000, y: 1000 });

      expect(elements).toEqual([
        { data: chartInstance.data.datasets[1]!.data[1], configIndex: 1 },
        { data: chartInstance.data.datasets[0]!.data[0], configIndex: 0 },
      ]);
    });

    it("should return elements sorted by proximity to a pixel dinamically", () => {
      const { chartRenderer } = setup();
      const chartInstance = (chartRenderer as any).getChartInstance();

      const element1 = {
        x: BasicBuilder.number({ min: 5, max: 15 }),
        y: BasicBuilder.number({ min: 5, max: 15 }),
      };
      const element2 = {
        x: BasicBuilder.number({ min: 16, max: 30 }),
        y: BasicBuilder.number({ min: 16, max: 30 }),
      };

      (chartInstance.getElementsAtEventForMode as jest.Mock).mockReturnValue([
        { element: element1, datasetIndex: 0, index: 0 },
        { element: element2, datasetIndex: 1, index: 1 },
      ]);

      chartInstance.data.datasets = [
        { data: [{ x: element1.x, y: element1.y }] },
        { data: [{ x: element2.x, y: element2.y }] },
      ];

      const pixelPoint = {
        x: BasicBuilder.number({ min: 500, max: 1000 }),
        y: BasicBuilder.number({ min: 500, max: 1000 }),
      };

      const elements = chartRenderer.getElementsAtPixel(pixelPoint);

      expect(elements).toEqual([{ data: { x: element1.x, y: element1.y }, configIndex: 0 }]);
    });
  });

  describe("updateDatasets", () => {
    it("should update dataset and disable animations", () => {
      const { chartRenderer } = setup();
      const datasets: Dataset[] = [
        { data: [{ x: BasicBuilder.number(), y: BasicBuilder.number() }] },
      ];
      const chartInstance = (chartRenderer as any).getChartInstance();
      const updateSpy = jest.spyOn(chartInstance, "update");

      const result = chartRenderer.updateDatasets(datasets);

      expect(chartInstance.data.datasets).toBe(datasets);
      expect(updateSpy).toHaveBeenCalledWith("none");
      expect(result).toEqual({
        min: chartInstance.scales.x?.min,
        max: chartInstance.scales.x?.max,
        left: chartInstance.scales.x?.left,
        right: chartInstance.scales.x?.right,
      });
    });
  });
});
