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
  Chart,
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
} from "chart.js";
import AnnotationPlugin from "chartjs-plugin-annotation";

import RobotoMono from "@foxglove-studio/app/styles/assets/latin-roboto-mono.woff2";
import { RpcLike } from "@foxglove-studio/app/util/FakeRpc";
import Rpc from "@foxglove-studio/app/util/Rpc";
import { setupWorker } from "@foxglove-studio/app/util/RpcWorkerUtils";

import ChartJSManager from "./ChartJSManager";

// Explicitly load the "Roboto Mono" font, since custom fonts from the main renderer are not
// inherited by web workers. This is required to draw "Roboto Mono" on an OffscreenCanvas, and it
// also appears to fix a crash a large portion of Windows users were seeing where the rendering
// thread would crash in skia code related to DirectWrite font loading when the system display
// scaling is set >100%.
async function loadDefaultFont(): Promise<FontFace> {
  const fontFace = new FontFace("Roboto Mono", `url(${RobotoMono}) format('woff2')`);
  (self as unknown as WorkerGlobalScope).fonts.add(fontFace);
  return fontFace.load();
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

// Since we use a capped number of web-workers, a single web-worker may be running multiple chartjs instances
// The ChartJsWorkerMux forwards an rpc request for a specific chartjs instance id to the appropriate instance
export default class ChartJsMux {
  private _rpc: RpcLike;
  private _managers = new Map<string, ChartJSManager>();

  constructor(rpc: RpcLike) {
    this._rpc = rpc;

    if (this._rpc instanceof Rpc) {
      setupWorker(this._rpc);
    }

    // create a new chartjs instance
    // this must be done before sending any other rpc requests to the instance
    rpc.receive("initialize", (args: any) => {
      args.fontLoaded = fontLoaded;
      const manager = new ChartJSManager(args);
      this._managers.set(args.id, manager);
      return manager.getScales();
    });
    rpc.receive("wheel", (args: any) => this._getChart(args.id).wheel(args.event));
    rpc.receive("mousedown", (args: any) => this._getChart(args.id).mousedown(args.event));
    rpc.receive("mousemove", (args: any) => this._getChart(args.id).mousemove(args.event));
    rpc.receive("mouseup", (args: any) => this._getChart(args.id).mouseup(args.event));
    rpc.receive("panstart", (args: any) => this._getChart(args.id).panstart(args.event));
    rpc.receive("panend", (args: any) => this._getChart(args.id).panend(args.event));
    rpc.receive("panmove", (args: any) => this._getChart(args.id).panmove(args.event));

    rpc.receive("update", (args: any) => this._getChart(args.id).update(args));
    rpc.receive("update-data", (args: any) => this._getChart(args.id).updateData(args));
    rpc.receive("destroy", (args: any) => {
      const manager = this._managers.get(args.id);
      if (manager) {
        manager.destroy();
        this._managers.delete(args.id);
      }
    });
    rpc.receive("getElementsAtEvent", (args: any) =>
      this._getChart(args.id).getElementsAtEvent(args),
    );
    rpc.receive("getDatalabelAtEvent", (args: any) =>
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
