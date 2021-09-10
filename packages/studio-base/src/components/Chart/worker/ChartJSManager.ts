// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Chart, ChartData, ChartOptions, ChartType } from "chart.js";
import type { Context as DatalabelContext } from "chartjs-plugin-datalabels";
import DatalabelPlugin from "chartjs-plugin-datalabels";
import { Zoom as ZoomPlugin } from "chartjs-plugin-zoom";
import EventEmitter from "eventemitter3";
import merge from "lodash/merge";

import Logger from "@foxglove/log";
import { RpcElement, RpcScales } from "@foxglove/studio-base/components/Chart/types";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const log = Logger.getLogger(__filename);

export type InitOpts = {
  id: string;
  node: OffscreenCanvas;
  type: ChartType;
  data: ChartData;
  options: ChartOptions;
  devicePixelRatio: number;
  fontLoaded: Promise<FontFace>;
};

// allows us to override the chart.ctx instance field which zoom plugin uses for adding event listeners
type MutableContext<T> = Omit<Chart, "ctx"> & { ctx: T };

function addEventListener(emitter: EventEmitter) {
  return (eventName: string, fn?: () => void) => {
    const existing = emitter.listeners(eventName);
    if (!fn || existing.includes(fn)) {
      return;
    }

    emitter.on(eventName, fn);
  };
}

function removeEventListener(emitter: EventEmitter) {
  return (eventName: string, fn?: () => void) => {
    if (fn) {
      emitter.off(eventName, fn);
    }
  };
}

type ZoomableChart = Chart & {
  $zoom: {
    panStartHandler(event: HammerInput): void;
    panHandler(event: HammerInput): void;
    panEndHandler(event: HammerInput): void;
  };
};

export default class ChartJSManager {
  private _chartInstance?: Chart;
  private _fakeNodeEvents = new EventEmitter();
  private _fakeDocumentEvents = new EventEmitter();
  private _lastDatalabelClickContext?: DatalabelContext;

  constructor(initOpts: InitOpts) {
    log.info(`new ChartJSManager(id=${initOpts.id})`);
    void this.init(initOpts);
  }

  async init({
    id,
    node,
    type,
    data,
    options,
    devicePixelRatio,
    fontLoaded,
  }: InitOpts): Promise<void> {
    const font = await fontLoaded;
    log.debug(`ChartJSManager(${id}) init, default font "${font.family}" status=${font.status}`);

    const fakeNode = {
      addEventListener: addEventListener(this._fakeNodeEvents),
      removeEventListener: removeEventListener(this._fakeNodeEvents),
      ownerDocument: {
        addEventListener: addEventListener(this._fakeDocumentEvents),
        removeEventListener: removeEventListener(this._fakeDocumentEvents),
      },
    };

    const origZoomStart = ZoomPlugin.start?.bind(ZoomPlugin);
    ZoomPlugin.start = (chartInstance: MutableContext<unknown>, args, pluginOptions) => {
      // swap the canvas with our fake dom node canvas to support zoom plugin addEventListener
      const ctx = chartInstance.ctx;
      chartInstance.ctx = {
        canvas: fakeNode,
      };
      const res = origZoomStart?.(chartInstance as Chart, args, pluginOptions);
      chartInstance.ctx = ctx;
      return res;
    };

    const fullOptions: ChartOptions = {
      ...this.addFunctionsToConfig(options),
      devicePixelRatio,
      font: { family: fonts.MONOSPACE },
      // we force responsive off since we manually trigger width/height updates on the chart
      // responsive mode does not work properly with offscreen canvases and retina device pixel ratios
      // it results in a run-away canvas that keeps doubling in size!
      responsive: false,
    };

    const chartInstance = new Chart(node, {
      type,
      data,
      options: fullOptions,
      plugins: [DatalabelPlugin, ZoomPlugin],
    });

    ZoomPlugin.start = origZoomStart;
    this._chartInstance = chartInstance;
  }

  wheel(event: WheelEvent): RpcScales {
    const target = event.target as Element & { boundingClientRect: DOMRect };
    target.getBoundingClientRect = () => target.boundingClientRect;
    this._fakeNodeEvents.emit("wheel", event);
    return this.getScales();
  }

  mousedown(event: MouseEvent): RpcScales {
    const target = event.target as Element & { boundingClientRect: DOMRect };
    target.getBoundingClientRect = () => target.boundingClientRect;
    this._fakeNodeEvents.emit("mousedown", event);
    return this.getScales();
  }

  mousemove(event: MouseEvent): RpcScales {
    const target = event.target as Element & { boundingClientRect: DOMRect };
    target.getBoundingClientRect = () => target.boundingClientRect;
    this._fakeNodeEvents.emit("mousemove", event);
    return this.getScales();
  }

  mouseup(event: MouseEvent): RpcScales {
    const target = event.target as Element & { boundingClientRect: DOMRect };
    target.getBoundingClientRect = () => target.boundingClientRect;
    this._fakeDocumentEvents.emit("mouseup", event);
    return this.getScales();
  }

  panstart(event: HammerInput): RpcScales {
    const target = event.target as HTMLElement & { boundingClientRect: DOMRect };
    target.getBoundingClientRect = () => target.boundingClientRect;
    (this._chartInstance as ZoomableChart)?.$zoom.panStartHandler(event);
    return this.getScales();
  }

  panmove(event: HammerInput): RpcScales {
    const target = event.target as HTMLElement & { boundingClientRect: DOMRect };
    target.getBoundingClientRect = () => target.boundingClientRect;
    (this._chartInstance as ZoomableChart)?.$zoom.panHandler(event);
    return this.getScales();
  }

  panend(event: HammerInput): RpcScales {
    const target = event.target as HTMLElement & { boundingClientRect: DOMRect };
    target.getBoundingClientRect = () => target.boundingClientRect;
    (this._chartInstance as ZoomableChart)?.$zoom.panEndHandler(event);
    return this.getScales();
  }

  update({
    options,
    width,
    height,
    data,
  }: {
    options?: ChartOptions;
    width?: number;
    height?: number;
    data?: ChartData;
  }): RpcScales {
    const instance = this._chartInstance;
    if (instance == undefined) {
      return {};
    }

    if (options != undefined) {
      instance.options.plugins = this.addFunctionsToConfig(options).plugins;

      // scales are special because we can mutate them interally via the zoom plugin
      instance.options.scales = merge(instance.options.scales, options.scales);
    }

    if (width != undefined || height != undefined) {
      let shouldResize = false;
      const wholeWidth = Math.floor(width ?? instance.width);
      const wholeHeight = Math.floor(height ?? instance.height);

      // Internally chartjs rounds width and height before updating the instance.
      // If our update has decimal width and height that will cause a resize on every update.
      // To avoid this we truncate the decimal from the width and height to present chartjs with whole
      // numbers.
      if (width != undefined) {
        if (Math.abs(instance.width - wholeWidth) > Number.EPSILON) {
          instance.canvas.width = wholeWidth;
          shouldResize = true;
        }
      }

      if (height != undefined) {
        if (Math.abs(instance.height - wholeHeight) > Number.EPSILON) {
          instance.canvas.height = wholeHeight;
          shouldResize = true;
        }
      }

      if (shouldResize) {
        instance.resize(wholeWidth, wholeHeight);
      }
    }

    if (data != undefined) {
      instance.data = data;
    }

    // While the chartjs API doesn't indicate update should be called after resize, in practice
    // we've found that performing a resize after an update sometimes results in a blank chart.
    //
    // NOTE: "none" disables animations - this is important for chart performance because we update
    // the entire data set which does not preserve history for the chart animations
    instance.update("none");

    return this.getScales();
  }

  destroy(): void {
    this._chartInstance?.destroy();
  }

  getElementsAtEvent({ event }: { event: MouseEvent }): RpcElement[] {
    const ev = {
      native: true,
      x: event.clientX,
      y: event.clientY,
    };

    // ev is cast to any because the typings for getElementsAtEventForMode are wrong
    // ev is specified as a dom Event - but the implementation does not require it for the basic platform
    const elements =
      this._chartInstance?.getElementsAtEventForMode(
        ev as unknown as Event,
        this._chartInstance.options.interaction?.mode ?? "intersect",
        this._chartInstance.options.interaction ?? {},
        false,
      ) ?? [];

    const out = new Array<RpcElement>();

    for (const element of elements) {
      const data = this._chartInstance?.data.datasets[element.datasetIndex]?.data[element.index];
      if (data == undefined || typeof data === "number") {
        continue;
      }

      // turn into an object we can send over the rpc
      out.push({
        view: {
          x: element.element.x,
          y: element.element.y,
        },
        data,
      });
    }

    // sort elemtents by proximity to the cursor
    out.sort((itemA, itemB) => {
      const dxA = event.clientX - itemA.view.x;
      const dyA = event.clientY - itemA.view.y;
      const dxB = event.clientX - itemB.view.x;
      const dyB = event.clientY - itemB.view.y;
      const distSquaredA = dxA * dxA + dyA * dyA;
      const distSquaredB = dxB * dxB + dyB * dyB;

      return distSquaredA - distSquaredB;
    });

    return out;
  }

  getDatalabelAtEvent({ event }: { event: Event }): unknown {
    this._chartInstance?.notifyPlugins("beforeEvent", { event });

    // clear the stored click context - we have consumed it
    const context = this._lastDatalabelClickContext;
    this._lastDatalabelClickContext = undefined;

    return context?.dataset.data[context.dataIndex];
  }

  // get the current chart scales in an rpc friendly format
  // all rpc methods return the current chart scale since that is the main thing that could change automatically
  getScales(): RpcScales {
    const scales: RpcScales = {};

    // fill our rpc scales - we only support x and y scales for now
    const xScale = this._chartInstance?.scales.x;
    if (xScale) {
      scales.x = {
        pixelMin: xScale.left,
        pixelMax: xScale.right,
        min: xScale.min,
        max: xScale.max,
      };
    }

    const yScale = this._chartInstance?.scales.y;
    if (yScale) {
      scales.y = {
        pixelMin: yScale.bottom,
        pixelMax: yScale.top,
        min: yScale.min,
        max: yScale.max,
      };
    }

    return scales;
  }

  // We cannot serialize functions over rpc, we add options that require functions here
  private addFunctionsToConfig(config: ChartOptions): typeof config {
    if (config.plugins?.datalabels) {
      // process _click_ events to get the label we clicked on
      // this is because datalabels does not export any public methods to lookup the clicked label
      // maybe we contribute a patch upstream with the explanation for web-worker use
      config.plugins.datalabels.listeners = {
        click: (context: DatalabelContext) => {
          this._lastDatalabelClickContext = context;
        },
      };

      // Only display labels for datapoints that include a "label" property
      config.plugins.datalabels.formatter = (value: { label?: string }, _context: unknown) => {
        // Return "null" if we don't want this label to be displayed.
        // Returning "undefined" falls back to the default formatting and will display
        // eslint-disable-next-line no-restricted-syntax
        return value?.label ?? null;
      };

      // Override color so that it can be set per-dataset.
      const staticColor = config.plugins.datalabels.color ?? "white";
      config.plugins.datalabels.color = (context: DatalabelContext) => {
        const value = context.dataset.data[context.dataIndex];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (value as any)?.labelColor ?? staticColor;
      };
    }

    return config;
  }
}
