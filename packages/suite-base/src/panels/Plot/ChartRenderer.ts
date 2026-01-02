// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Chart } from "chart.js";
import { AnnotationOptions } from "chartjs-plugin-annotation";
import EventEmitter from "eventemitter3";

import { Zoom as ZoomPlugin } from "@lichtblick/chartjs-plugin-zoom";
import { unwrap } from "@lichtblick/den/monads";
import { Immutable } from "@lichtblick/suite";
import {
  addEventListener,
  removeEventListener,
} from "@lichtblick/suite-base/components/Chart/worker/eventHandler";
import { DEFAULT_ANNOTATION } from "@lichtblick/suite-base/panels/Plot/constants";
import { getChartOptions } from "@lichtblick/suite-base/panels/Plot/utils/getChartOptions";
import { Bounds } from "@lichtblick/suite-base/types/Bounds";
import { maybeCast } from "@lichtblick/suite-base/util/maybeCast";

import {
  ChartRendererProps,
  ChartType,
  Dataset,
  Datum,
  HoverElement,
  InteractionEvent,
  MutableContext,
  Scale,
  UpdateAction,
  ZoomableChart,
} from "./types";

export class ChartRenderer {
  #chartInstance: ChartType;
  #fakeNodeEvents = new EventEmitter();
  #fakeDocumentEvents = new EventEmitter();

  public constructor(args: ChartRendererProps) {
    const fakeNode = {
      addEventListener: addEventListener(this.#fakeNodeEvents),
      removeEventListener: removeEventListener(this.#fakeNodeEvents),
      ownerDocument: {
        addEventListener: addEventListener(this.#fakeDocumentEvents),
        removeEventListener: removeEventListener(this.#fakeDocumentEvents),
      },
    };

    const chartOptions = getChartOptions({
      devicePixelRatio: args.devicePixelRatio,
      gridColor: args.gridColor,
      tickColor: args.tickColor,
    });

    const origZoomStart = ZoomPlugin.start?.bind(ZoomPlugin);
    ZoomPlugin.start = (chartInstance: MutableContext<unknown>, startArgs, pluginOptions) => {
      // swap the canvas with our fake dom node canvas to support zoom plugin addEventListener
      const ctx = chartInstance.ctx;
      chartInstance.ctx = {
        canvas: fakeNode,
      };
      const res = origZoomStart?.(chartInstance as Chart, startArgs, pluginOptions);
      chartInstance.ctx = ctx;
      return res;
    };

    // ChartJS supports offscreen canvas however the type definitions do not so we need to cast and
    // fool the constructor.
    //
    // https://www.chartjs.org/docs/latest/general/performance.html#parallel-rendering-with-web-workers-chromium-only
    const canvas = args.canvas as unknown as HTMLCanvasElement;
    const chartInstance = new Chart<"scatter", Datum[]>(canvas, {
      type: "scatter",
      data: {
        datasets: [],
      },
      options: chartOptions,
      plugins: [ZoomPlugin],
    });

    ZoomPlugin.start = origZoomStart;
    this.#chartInstance = chartInstance;
  }

  public update(action: Immutable<UpdateAction>): Bounds | undefined {
    if (action.size) {
      this.#chartInstance.canvas.width = action.size.width;
      this.#chartInstance.canvas.height = action.size.height;
      this.#chartInstance.resize();
    }

    if (action.yBounds) {
      const scaleOption = this.#chartInstance.options.scales?.y;
      if (scaleOption && scaleOption.min !== action.yBounds.min) {
        scaleOption.min = action.yBounds.min;
      }
      if (scaleOption && scaleOption.max !== action.yBounds.max) {
        scaleOption.max = action.yBounds.max;
      }
    }

    if (action.xBounds) {
      const scaleOption = this.#chartInstance.options.scales?.x;
      if (scaleOption && scaleOption.min !== action.xBounds.min) {
        scaleOption.min = action.xBounds.min;
      }

      if (scaleOption && scaleOption.max !== action.xBounds.max) {
        scaleOption.max = action.xBounds.max;
      }
    }

    if (action.showYAxisLabels != undefined) {
      const ticksOptions = this.#chartInstance.options.scales?.y?.ticks;
      if (ticksOptions) {
        ticksOptions.display = action.showYAxisLabels;
      }
    }

    if (action.showXAxisLabels != undefined) {
      const ticksOptions = this.#chartInstance.options.scales?.x?.ticks;
      if (ticksOptions) {
        ticksOptions.display = action.showXAxisLabels;
      }
    }

    if (action.interactionEvents) {
      for (const event of action.interactionEvents) {
        this.#applyInteractionEvent(event);
      }
    }

    if (action.zoomMode) {
      unwrap(this.#chartInstance.options.plugins?.zoom?.zoom).mode = action.zoomMode;
    }

    if (action.referenceLines) {
      const annotation = this.#chartInstance.options.plugins?.annotation;
      if (!annotation) {
        return;
      }

      const newAnnotations: AnnotationOptions[] = action.referenceLines.map((config) => {
        return {
          ...DEFAULT_ANNOTATION,
          borderColor: config.color,
          value: config.value,
        };
      });

      annotation.annotations = newAnnotations;
    }

    // NOTE: "none" disables animations - this is important for chart performance because we update
    // the entire data set which does not preserve history for the chart animations
    this.#chartInstance.update("none");

    // fill our rpc scales - we only support x and y scales for now
    const xScale = this.#chartInstance.scales.x;
    const yScale = this.#chartInstance.scales.y;

    if (!xScale || !yScale) {
      return undefined;
    }

    return {
      x: {
        min: xScale.min,
        max: xScale.max,
      },
      y: {
        min: yScale.min,
        max: yScale.max,
      },
    };
  }

  public getElementsAtPixel(pixel: { x: number; y: number }): HoverElement[] {
    const x = pixel.x;
    const y = pixel.y;

    const ev = {
      native: true,
      x,
      y,
    };

    // ev is cast to any because the typings for getElementsAtEventForMode are wrong
    // ev is specified as a dom Event - but the implementation does not require it for the basic platform
    const elements = this.#chartInstance.getElementsAtEventForMode(
      ev as unknown as Event,
      this.#chartInstance.options.interaction?.mode ?? "intersect",
      this.#chartInstance.options.interaction ?? {},
      false,
    );

    const out: HoverElement[] = [];

    // sort elements by proximity to the cursor so the closer items are earlier in the list
    elements.sort((a, b) => {
      const dxA = pixel.x - a.element.x;
      const dyA = pixel.y - a.element.y;
      const dxB = pixel.x - b.element.x;
      const dyB = pixel.y - b.element.y;
      const distSquaredA = dxA * dxA + dyA * dyA;
      const distSquaredB = dxB * dxB + dyB * dyB;
      return distSquaredA - distSquaredB;
    });

    for (const element of elements) {
      const data = this.#chartInstance.data.datasets[element.datasetIndex]?.data[element.index];
      if (data == undefined || typeof data === "number") {
        continue;
      }

      out.push({
        data,
        configIndex: element.datasetIndex,
      });
    }

    return out;
  }

  public updateDatasets(datasets: Dataset[]): Scale | undefined {
    this.#chartInstance.data.datasets = datasets;

    // While the chartjs API doesn't indicate update should be called after resize, in practice
    // we've found that performing a resize after an update sometimes results in a blank chart.
    //
    // NOTE: "none" disables animations - this is important for chart performance because we update
    // the entire data set which does not preserve history for the chart animations
    this.#chartInstance.update("none");
    return this.#getXScale();
  }

  #getXScale(): Scale | undefined {
    const xScale = this.#chartInstance.scales.x;
    if (!xScale) {
      return undefined;
    }

    return {
      min: xScale.min,
      max: xScale.max,
      left: xScale.left,
      right: xScale.right,
    };
  }

  #applyInteractionEvent(event: Immutable<InteractionEvent>): void {
    const { type, boundingClientRect, ...rest } = event;
    switch (type) {
      case "wheel":
        this.#fakeNodeEvents.emit("wheel", {
          ...rest,
          target: {
            getBoundingClientRect() {
              return boundingClientRect;
            },
          },
        });
        break;
      case "panstart":
        maybeCast<ZoomableChart>(this.#chartInstance)?.$zoom.panStartHandler({
          center: event.center,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          target: {
            getBoundingClientRect() {
              return boundingClientRect;
            },
          },
        });
        break;
      case "panmove":
        maybeCast<ZoomableChart>(this.#chartInstance)?.$zoom.panHandler(event);
        break;
      case "panend":
        maybeCast<ZoomableChart>(this.#chartInstance)?.$zoom.panEndHandler();
        break;
    }
  }

  /**
   * Exposed as protected for unit testing strictly private fields.
   * Developers are encouraged to avoid using these methods in production logic.
   */
  protected getChartInstance(): ChartType {
    return this.#chartInstance;
  }

  /**
   * Exposed as protected for unit testing strictly private fields.
   * Developers are encouraged to avoid using these methods in production logic.
   */
  protected getFakeNodeEvents(): EventEmitter {
    return this.#fakeNodeEvents;
  }
}
