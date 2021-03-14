/* eslint-disable header/header */
// This file is forked from https://github.com/jerairrest/react-chartjs-2/tree/111f3590a008b8211217e613b5531fb00c3a431b.
// We are upgrading this wrapper of Chart.js to handle rendering Chart.js within a worker.

// The follow license applies to this file only:

// The MIT License (MIT)

// Copyright (c) 2017 Jeremy Ayerst

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
// Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import Hammer from "hammerjs";
import React from "react";
import { v4 as uuidv4 } from "uuid";

import { ScaleOptions as ManagerScaleOptions } from "./ChartJSManager";
// eslint-disable-next-line import/no-unresolved
import { ScaleBounds, ZoomOptions, PanOptions, wheelZoomHandler } from "./zoomAndPanHelpers";
import { objectValues } from "@foxglove-studio/app/util";
import { getFakeRpcs, RpcLike } from "@foxglove-studio/app/util/FakeRpc";
import WebWorkerManager from "@foxglove-studio/app/util/WebWorkerManager";
import supportsOffscreenCanvas from "@foxglove-studio/app/util/supportsOffscreenCanvas";
// eslint-disable-next-line import/default
import ChartJSWorker from "worker-loader!./ChartJSWorker.worker.ts";

const getMainThreadChartJSWorker = () =>
  import(
    /* webpackChunkName: "main-thread-chartjs" */
    "./ChartJSWorker"
  );

export type HoveredElement = any;
export type ScaleOptions = ManagerScaleOptions;
type OnEndChartUpdate = () => void;

type Props = {
  id?: string;
  data: Chart.ChartData;
  height: number;
  width: number;
  legend?: Chart.ChartLegendOptions;
  options: Chart.ChartOptions;
  type: string;
  zoomOptions: ZoomOptions;
  panOptions: PanOptions;
  onScaleBoundsUpdate?: (arg0: ScaleBounds[]) => void;
  onPanZoom?: (arg0: ScaleBounds[]) => void;
  onClick?: (
    arg0: React.MouseEvent<HTMLCanvasElement>,
    datalabel: ScaleBounds[] | undefined,
  ) => void;
  forceDisableWorkerRendering?: boolean;
  scaleOptions?: ScaleOptions;
  onChartUpdate?: () => OnEndChartUpdate;
};

const devicePixelRatio = window.devicePixelRatio || 1;

const webWorkerManager = new WebWorkerManager(ChartJSWorker, 4);

class ChartComponent extends React.PureComponent<Props> {
  canvas?: HTMLCanvasElement;
  _chartRpc?: RpcLike;
  _node?: OffscreenCanvas;
  _id = uuidv4();
  _scaleBoundsByScaleId = {};
  _usingWebWorker = false;
  _onEndChartUpdateCallbacks: Record<string, () => void> = {};

  constructor(props: Props) {
    super(props);
    this._getRpc();
  }

  static defaultProps = {
    legend: {
      display: true,
      position: "bottom",
    },
    type: "doughnut",
    height: 150,
    width: 300,
    options: {},
    zoomOptions: { mode: "xy", enabled: true, sensitivity: 3, speed: 0.1 },
    panOptions: { mode: "xy", enabled: true, speed: 20, threshold: 10 },
  };

  _getRpc = async (): Promise<RpcLike> => {
    if (this._chartRpc) {
      return this._chartRpc;
    }

    if (!this.props.forceDisableWorkerRendering && supportsOffscreenCanvas()) {
      // Only use a real chart worker if we support offscreenCanvas.
      this._chartRpc = webWorkerManager.registerWorkerListener(this._id);
      this._usingWebWorker = true;
    } else {
      // Otherwise use a fake RPC so that we don't have to maintain two separate APIs.
      const { mainThreadRpc, workerRpc } = getFakeRpcs();
      const { default: MainThreadChartJSWorker } = await getMainThreadChartJSWorker();
      new MainThreadChartJSWorker(workerRpc);
      this._chartRpc = mainThreadRpc;
      this._usingWebWorker = false;
    }
    return this._chartRpc;
  };

  _sendToRpc = async (event: string, data: any, transferrables?: any[]): Promise<ScaleBounds[]> => {
    const rpc = await this._getRpc();
    return rpc.send(event, data, transferrables);
  };

  componentDidMount(): void {
    const { type, data, options, scaleOptions, width, height } = this.props;
    if (!this.canvas) {
      throw new Error("ReactChartJS not initialized");
    }
    if (!this.canvas.transferControlToOffscreen) {
      // TODO add fallback.
      throw new Error(
        "ReactChartJS currently only works with browsers with offscreen canvas support",
      );
    }

    this._setupPanAndPinchHandlers();

    const node = this.canvas.transferControlToOffscreen();
    this._node = node;
    this._sendToRpc(
      "initialize",
      {
        node,
        id: this._id,
        type,
        data,
        options,
        scaleOptions,
        devicePixelRatio,
        width,
        height,
      },
      [node],
    ).then((scaleBoundsUpdate) => this._onUpdateScaleBounds(scaleBoundsUpdate));
  }

  componentDidUpdate(): void {
    const { data, options, scaleOptions, width, height, onChartUpdate } = this.props;
    let chartUpdateId: string;
    if (onChartUpdate) {
      const onEndChartUpdate = onChartUpdate();
      chartUpdateId = uuidv4();
      this._onEndChartUpdateCallbacks[chartUpdateId] = onEndChartUpdate;
    }
    this._sendToRpc("update", {
      id: this._id,
      data,
      options,
      scaleOptions,
      width,
      height,
    })
      .then((scaleBoundsUpdate) => {
        this._onUpdateScaleBounds(scaleBoundsUpdate);
      })
      .finally(() => {
        const onEndChartUpdateCallback = this._onEndChartUpdateCallbacks[chartUpdateId];
        if (onEndChartUpdateCallback) {
          onEndChartUpdateCallback();
          delete this._onEndChartUpdateCallbacks[chartUpdateId];
        }
      });
  }

  componentWillUnmount(): void {
    // If this component will unmount, resolve any pending update callbacks.
    objectValues(this._onEndChartUpdateCallbacks).forEach((callback) => callback());
    this._onEndChartUpdateCallbacks = {};

    if (this._chartRpc) {
      this._chartRpc.send("destroy", { id: this._id });
      this._chartRpc = undefined;

      if (this._usingWebWorker) {
        webWorkerManager.unregisterWorkerListener(this._id);
      }
    }
  }

  _ref = (element?: HTMLCanvasElement | null): void => {
    this.canvas = element ?? undefined;
  };

  getElementAtXAxis = async (
    event: React.MouseEvent<any> | MouseEvent,
  ): Promise<HoveredElement | undefined> => {
    if (!this.canvas) {
      return Promise.resolve(undefined);
    }

    const boundingRect = this.canvas.getBoundingClientRect();
    if (
      event.clientX < boundingRect.left ||
      event.clientX > boundingRect.right ||
      event.clientY < boundingRect.top ||
      event.clientY > boundingRect.bottom
    ) {
      return Promise.resolve(undefined);
    }

    const newEvent = {
      native: true,
      x: event.clientX - boundingRect.left,
      y: event.clientY - boundingRect.top,
    };
    return this._sendToRpc("getElementAtXAxis", { id: this._id, event: newEvent });
  };

  // Pan/zoom section

  resetZoom = async (): Promise<void> => {
    const scaleBoundsUpdate = await this._sendToRpc("resetZoom", { id: this._id });
    this._onUpdateScaleBounds(scaleBoundsUpdate);
  };

  _panning = false;
  _currentDeltaX?: number;
  _currentDeltaY?: number;
  _currentPinchScaling = 1;

  _setupPanAndPinchHandlers(): void {
    if (!this.canvas) {
      throw new Error("ReactChartJS not initialized");
    }
    const { threshold } = this.props.panOptions;
    const hammerManager = new Hammer.Manager(this.canvas);
    hammerManager.add(new Hammer.Pinch());
    hammerManager.add(new Hammer.Pan({ threshold }));

    const hammerPanHandler = async (event: HammerInput) => {
      if (!this.props.panOptions.enabled) {
        return;
      }
      if (this._currentDeltaX !== undefined && this._currentDeltaY !== undefined) {
        const deltaX = event.deltaX - this._currentDeltaX;
        const deltaY = event.deltaY - this._currentDeltaY;
        this._currentDeltaX = event.deltaX;
        this._currentDeltaY = event.deltaY;
        const scaleBoundsUpdate = await this._sendToRpc("doPan", {
          id: this._id,
          panOptions: this.props.panOptions,
          deltaX,
          deltaY,
        });
        this._onPanZoom(scaleBoundsUpdate);
        this._onUpdateScaleBounds(scaleBoundsUpdate);
      }
    };

    hammerManager.on("panstart", (event) => {
      this._panning = true;
      this._currentDeltaX = 0;
      this._currentDeltaY = 0;
      hammerPanHandler(event);
    });
    hammerManager.on("panmove", hammerPanHandler);
    hammerManager.on("panend", () => {
      this._currentDeltaX = undefined;
      this._currentDeltaY = undefined;
      this._sendToRpc("resetPanDelta", this._id);
      setTimeout(() => {
        this._panning = false;
      }, 500);
    });

    // TODO: pinch gestures only kind of work right now - the built-in browser pinch zoom takes over if pinch is too
    // aggressive. Figure out why this is happening and fix it. This is almost identical to the original plugin that
    // does not have this problem.
    const handlePinch = async (e: HammerInput) => {
      if (!this.props.panOptions.enabled) {
        return;
      }
      const diff = (1 / this._currentPinchScaling) * e.scale;
      const rect = e.target.getBoundingClientRect();
      const offsetX = e.center.x - rect.left;
      const offsetY = e.center.y - rect.top;
      const center = {
        x: offsetX,
        y: offsetY,
      };

      // fingers position difference
      const x = Math.abs(e.pointers[0].clientX - e.pointers[1].clientX);
      const y = Math.abs(e.pointers[0].clientY - e.pointers[1].clientY);

      // diagonal fingers will change both (xy) axes
      const p = x / y;
      let xy;
      if (p > 0.3 && p < 1.7) {
        xy = "xy";
      } else if (x > y) {
        xy = "x"; // x axis
      } else {
        xy = "y"; // y axis
      }

      // Keep track of overall scale
      this._currentPinchScaling = e.scale;

      const scaleBoundsUpdate = await this._sendToRpc("doZoom", {
        id: this._id,
        zoomOptions: this.props.zoomOptions,
        percentZoomX: diff,
        percentZoomY: diff,
        focalPoint: center,
        whichAxesParam: xy,
      });
      this._onPanZoom(scaleBoundsUpdate);
      this._onUpdateScaleBounds(scaleBoundsUpdate);
    };

    hammerManager.on("pinchstart", () => {
      this._currentPinchScaling = 1; // reset tracker
    });
    hammerManager.on("pinch", handlePinch);
    hammerManager.on("pinchend", (e) => {
      handlePinch(e);
      this._currentPinchScaling = 1; // reset
      this._sendToRpc("resetZoomDelta", { id: this._id });
    });
  }

  _onWheel = async (event: React.WheelEvent<HTMLCanvasElement>): Promise<void> => {
    if (!this.props.zoomOptions.enabled) {
      return;
    }
    const { percentZoomX, percentZoomY, focalPoint } = wheelZoomHandler(
      event,
      this.props.zoomOptions,
    );
    const scaleBoundsUpdate = await this._sendToRpc("doZoom", {
      id: this._id,
      zoomOptions: this.props.zoomOptions,
      percentZoomX,
      percentZoomY,
      focalPoint,
      whichAxesParam: "xy",
    });
    this._onUpdateScaleBounds(scaleBoundsUpdate);
    this._onPanZoom(scaleBoundsUpdate);
  };

  _onPanZoom = (scaleBoundsUpdate: ScaleBounds[]): void => {
    if (this.props.onPanZoom) {
      this.props.onPanZoom(scaleBoundsUpdate);
    }
  };

  _onUpdateScaleBounds = (scaleBoundsUpdate: ScaleBounds[]): void => {
    if (this.props.onScaleBoundsUpdate && scaleBoundsUpdate) {
      this.props.onScaleBoundsUpdate(scaleBoundsUpdate);
    }
  };

  _onClick = async (event: React.MouseEvent<HTMLCanvasElement>): Promise<void> => {
    const { onClick } = this.props;
    if (!this._panning && onClick && this.canvas) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const newEvent = { x, y };
      // Since our next call is asynchronous, we have to persist the event so that React doesn't clear it.
      event.persist();
      const datalabel = await this._sendToRpc("getDatalabelAtEvent", {
        id: this._id,
        event: newEvent,
      });
      onClick(event, datalabel);
    }
  };

  render(): JSX.Element {
    const { height, width, id } = this.props;

    return (
      <canvas
        ref={this._ref}
        height={height / devicePixelRatio}
        width={width / devicePixelRatio}
        id={id}
        onWheel={this._onWheel}
        onClick={this._onClick}
        style={{ width, height }}
      />
    );
  }
}

export default ChartComponent;
