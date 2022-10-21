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

import {
  CategoryScale,
  Chart,
  ChartData,
  ChartOptions,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Ticks,
  TimeScale,
  TimeSeriesScale,
  Title,
  Tooltip,
} from "chart.js";
import AnnotationPlugin from "chartjs-plugin-annotation";

import PlexMono from "@foxglove/studio-base/styles/assets/PlexMono.woff2";
import Rpc from "@foxglove/studio-base/util/Rpc";
import { setupWorker } from "@foxglove/studio-base/util/RpcWorkerUtils";

import ChartJSManager, { InitOpts } from "./ChartJSManager";

type RpcEvent<EventType> = { id: string; event: EventType };

export type ChartUpdateMessage = {
  data?: ChartData;
  height?: number;
  options?: ChartOptions;
  isBoundsReset: boolean;
  width?: number;
};

type RpcUpdateEvent = {
  id: string;
} & ChartUpdateMessage;

// Explicitly load the "Plex Mono" font, since custom fonts from the main renderer are not inherited
// by web workers. This is required to draw "Plex Mono" on an OffscreenCanvas, and it also appears
// to fix a crash a large portion of Windows users were seeing where the rendering thread would
// crash in skia code related to DirectWrite font loading when the system display scaling is set
// >100%. For more info on this crash, see util/waitForFonts.ts.
async function loadDefaultFont(): Promise<FontFace> {
  const fontFace = new FontFace("IBM Plex Mono", `url(${PlexMono}) format('woff2')`);
  if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    (self as unknown as WorkerGlobalScope).fonts.add(fontFace);
  } else {
    document.fonts.add(fontFace);
  }
  return await fontFace.load();
}

// Immediately start font loading in the Worker thread. Each ChartJSManager we instantiate will
// wait on this promise before instantiating a new Chart instance, which kicks off rendering
const fontLoaded = loadDefaultFont();

// Register the features we support globally on our chartjs instance
// Note: Annotation plugin must be registered, it does not work _inline_ (i.e. per instance)
Chart.register(
  LineElement,
  PointElement,
  LineController,
  ScatterController,
  CategoryScale,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  Filler,
  Legend,
  Title,
  Tooltip,
  AnnotationPlugin,
);

const fixedNumberFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/**
 * Adjust the `ticks` of the chart options to ensure the first/last x labels remain a constant
 * width. See https://github.com/foxglove/studio/issues/2926
 *
 * Because this requires passing a `callback` function for the tick options, this has to be done in
 * the worker, since functions can't be sent via postMessage.
 */
function fixTicks(args: RpcUpdateEvent): RpcUpdateEvent {
  const xScale = args.options?.scales?.x;

  if (xScale?.ticks) {
    xScale.ticks.callback = function (value, index, ticks) {
      // use a fixed formatter for the first/last ticks
      if (index === 0 || index === ticks.length - 1) {
        return fixedNumberFormat.format(value as number);
      }
      // otherwise use chart.js's default formatter
      return Ticks.formatters.numeric.apply(this, [value as number, index, ticks]);
    };
  }
  return args;
}

// Since we use a capped number of web-workers, a single web-worker may be running multiple chartjs instances
// The ChartJsWorkerMux forwards an rpc request for a specific chartjs instance id to the appropriate instance
export default class ChartJsMux {
  private readonly _rpc: Rpc;
  private readonly _managers = new Map<string, ChartJSManager>();

  public constructor(rpc: Rpc) {
    this._rpc = rpc;

    if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
      setupWorker(this._rpc);
    }

    // create a new chartjs instance
    // this must be done before sending any other rpc requests to the instance
    rpc.receive("initialize", (args: InitOpts) => {
      args.fontLoaded = fontLoaded;
      const manager = new ChartJSManager(args);
      this._managers.set(args.id, manager);
      return manager.getScales();
    });
    rpc.receive("wheel", (args: RpcEvent<WheelEvent>) => this._getChart(args.id).wheel(args.event));
    rpc.receive("mousedown", (args: RpcEvent<MouseEvent>) =>
      this._getChart(args.id).mousedown(args.event),
    );
    rpc.receive("mousemove", (args: RpcEvent<MouseEvent>) =>
      this._getChart(args.id).mousemove(args.event),
    );
    rpc.receive("mouseup", (args: RpcEvent<MouseEvent>) =>
      this._getChart(args.id).mouseup(args.event),
    );
    rpc.receive("panstart", (args: RpcEvent<HammerInput>) =>
      this._getChart(args.id).panstart(args.event),
    );
    rpc.receive("panend", (args: RpcEvent<HammerInput>) =>
      this._getChart(args.id).panend(args.event),
    );
    rpc.receive("panmove", (args: RpcEvent<HammerInput>) =>
      this._getChart(args.id).panmove(args.event),
    );

    rpc.receive("update", (args: RpcUpdateEvent) => this._getChart(args.id).update(fixTicks(args)));
    rpc.receive("destroy", (args: RpcEvent<void>) => {
      const manager = this._managers.get(args.id);
      if (manager) {
        manager.destroy();
        this._managers.delete(args.id);
      }
    });
    rpc.receive("getElementsAtEvent", (args: RpcEvent<MouseEvent>) =>
      this._getChart(args.id).getElementsAtEvent(args),
    );
    rpc.receive("getDatalabelAtEvent", (args: RpcEvent<Event>) =>
      this._getChart(args.id).getDatalabelAtEvent(args),
    );
  }

  private _getChart(id: string): ChartJSManager {
    const chart = this._managers.get(id);
    if (!chart) {
      throw new Error(`Could not find chart with id ${id}`);
    }
    return chart;
  }
}
