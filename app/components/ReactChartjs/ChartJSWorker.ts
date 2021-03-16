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

import Chart from "chart.js";

import { RpcLike } from "@foxglove-studio/app/util/FakeRpc";
import Rpc from "@foxglove-studio/app/util/Rpc";
import { setupWorker } from "@foxglove-studio/app/util/RpcWorkerUtils";
import installChartjs from "@foxglove-studio/app/util/installChartjs";
import { inWebWorker } from "@foxglove-studio/app/util/workers";

import ChartJSManager from "./ChartJSManager";

let hasInstalledChartjs = false;

export default class ChartJSWorker {
  _rpc: RpcLike;
  _managersById: {
    [key: string]: ChartJSManager;
  };

  constructor(rpc: RpcLike) {
    if (!hasInstalledChartjs) {
      installChartjs(Chart);
      hasInstalledChartjs = true;
    }
    this._managersById = {};
    this._rpc = rpc;

    if (process.env.NODE_ENV !== "test" && inWebWorker() && this._rpc instanceof Rpc) {
      setupWorker(this._rpc);
    }

    rpc.receive("initialize", (args: any) => {
      const manager = new ChartJSManager(args);
      this._managersById[args.id] = manager;
      return this._managersById[args.id].getScaleBounds();
    });
    rpc.receive("doZoom", (args: any) => this._managersById[args.id]?.doZoom(args));
    rpc.receive("resetZoomDelta", (args: any) => this._managersById[args.id]?.resetZoomDelta());
    rpc.receive("doPan", (args: any) => this._managersById[args.id]?.doPan(args));
    rpc.receive("resetPanDelta", (args: any) => this._managersById[args.id]?.resetPanDelta());
    rpc.receive("update", (args: any) => this._managersById[args.id]?.update(args));
    rpc.receive("resetZoom", (args: any) => this._managersById[args.id]?.resetZoom());
    rpc.receive("destroy", (args: any) => {
      const manager = this._managersById[args.id];
      if (manager) {
        const result = manager.destroy();
        delete this._managersById[args.id];
        return result;
      }
    });
    rpc.receive("getElementAtXAxis", (args: any) =>
      this._managersById[args.id]?.getElementAtXAxis(args),
    );
    rpc.receive("getDatalabelAtEvent", (args: any) =>
      this._managersById[args.id]?.getDatalabelAtEvent(args),
    );
  }
}
