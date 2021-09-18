// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// These modules declaration merge into chart.js declarations for plugins
// Since we don't use the modules directly in this file, we need to load the types as references
// so typescript will have the merged declarations.
/// <reference types="chartjs-plugin-datalabels" />
/// <reference types="chartjs-plugin-zoom" />

import { ChartOptions, ChartData as ChartJsChartData, ScatterDataPoint } from "chart.js";
import Hammer from "hammerjs";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAsync, useMountedState } from "react-use";
import { v4 as uuidv4 } from "uuid";

import Logger from "@foxglove/log";
import { RpcElement, RpcScales } from "@foxglove/studio-base/components/Chart/types";
import WebWorkerManager from "@foxglove/studio-base/util/WebWorkerManager";

const log = Logger.getLogger(__filename);

function makeChartJSWorker() {
  return new Worker(new URL("./worker/main", import.meta.url));
}

export type OnClickArg = {
  datalabel?: unknown;
  // x-value in scale
  x: number | undefined;
  // y-value in scale
  y: number | undefined;
};

// Chartjs typings use _null_ to indicate _gaps_ in the dataset
// eslint-disable-next-line no-restricted-syntax
const ChartNull = null;
export type ChartData = ChartJsChartData<"scatter", (ScatterDataPoint | typeof ChartNull)[]>;

type Props = {
  data: ChartData;
  options: ChartOptions;
  type: string;
  height: number;
  width: number;
  onClick?: (params: OnClickArg) => void;

  // called when the chart scales have updated (happens for zoom/pan/reset)
  onScalesUpdate?: (scales: RpcScales, opt: { userInteraction: boolean }) => void;

  // called when the chart has finished updating with new data
  onChartUpdate?: () => void;

  // called when a user hovers over an element
  // uses the chart.options.hover configuration
  onHover?: (elements: RpcElement[]) => void;
};

const devicePixelRatio = window.devicePixelRatio ?? 1;

const webWorkerManager = new WebWorkerManager(makeChartJSWorker, 4);

// turn a React.MouseEvent into an object we can send over rpc
function rpcMouseEvent(event: React.MouseEvent<HTMLCanvasElement>) {
  const boundingRect = event.currentTarget.getBoundingClientRect();

  return {
    cancelable: false,
    clientX: event.clientX - boundingRect.left,
    clientY: event.clientY - boundingRect.top,
    target: {
      boundingClientRect: boundingRect.toJSON(),
    },
  };
}

type RpcSend = <T extends unknown>(
  topic: string,
  payload?: Record<string, unknown>,
  transferables?: (Transferable | OffscreenCanvas)[],
) => Promise<T>;

// Chart component renders data using workers with chartjs offscreen canvas
function Chart(props: Props): JSX.Element {
  const [id] = useState(() => uuidv4());

  const initialized = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(ReactNull);
  const isMounted = useMountedState();

  // to avoid changing useCallback deps for callbacks which access the scale value
  // at the time they are invoked
  const currentScalesRef = useRef<RpcScales | undefined>();

  const zoomEnabled = props.options.plugins?.zoom?.zoom?.enabled ?? false;
  const panEnabled = props.options.plugins?.zoom?.pan?.enabled ?? false;

  const { type, data, options, width, height, onChartUpdate } = props;

  const sendWrapperRef = useRef<RpcSend | undefined>();
  const rpcSendRef = useRef<RpcSend | undefined>();

  useLayoutEffect(() => {
    if (initialized.current) {
      if (process.env.NODE_ENV === "development") {
        throw new Error("Chart does not support hot-reloading - please reload the panel");
      } else {
        throw new Error("Chart has re-initialized unexpectedly");
      }
    }

    log.info(`Register Chart ${id}`);
    const rpc = webWorkerManager.registerWorkerListener(id);

    // helper function to send rpc to our worker - all invocations need an _id_ so we inject it here
    const sendWrapper = async <T extends unknown>(
      topic: string,
      payload?: Record<string, unknown>,
      transferables?: (Transferable | OffscreenCanvas)[],
    ) => {
      return await rpc.send<T>(topic, { id, ...payload }, transferables);
    };

    // store the send wrapper so it can be set to rpcSendRef once initialization occurs
    sendWrapperRef.current = sendWrapper;

    return () => {
      log.info(`Unregister chart ${id}`);
      rpcSendRef.current = undefined;
      void sendWrapper("destroy");
      webWorkerManager.unregisterWorkerListener(id);
    };
  }, [id]);

  // trigger when scales update
  const onScalesUpdateRef = useRef(props.onScalesUpdate);
  onScalesUpdateRef.current = props.onScalesUpdate;

  const maybeUpdateScales = useCallback(
    (newScales: RpcScales, opt?: { userInteraction: boolean }) => {
      if (!isMounted()) {
        return;
      }

      const oldScales = currentScalesRef.current;
      currentScalesRef.current = newScales;

      // cheap hack to only update the scales when the values change
      // avoids triggering handlers that depend on scales
      const oldStr = JSON.stringify(oldScales);
      const newStr = JSON.stringify(newScales);
      if (oldStr !== newStr) {
        onScalesUpdateRef.current?.(newScales, opt ?? { userInteraction: false });
      }
    },
    [isMounted],
  );

  const previousUpdateMessage = useRef<Record<string, unknown>>({});

  // getNewUpdateMessage returns an update message for the changed fields from the last
  // call to get an update message
  //
  // The purpose of this mechanism is to avoid sending data/options/size to the worker
  // if they are unchanged from a previous initialization or update.
  const getNewUpdateMessage = useCallback(() => {
    const prev = previousUpdateMessage.current;
    const out: Record<string, unknown> = {};

    // NOTE(Roman): I don't know why this happens but when I initialize a chart using some data
    // and width/height of 0. Even when I later send an update for correct width/height the chart
    // does not render.
    //
    // The workaround here is to avoid sending any initialization or update messages until we have
    // a width and height that are non-zero
    if (width === 0 || height === 0) {
      return undefined;
    }

    if (prev.data !== data) {
      prev.data = out.data = data;
    }
    if (prev.options !== options) {
      prev.options = out.options = options;
    }
    if (prev.height !== height) {
      prev.height = out.height = height;
    }
    if (prev.width !== width) {
      prev.width = out.width = width;
    }

    // nothing to update
    if (Object.keys(out).length === 0) {
      return;
    }

    return out;
  }, [data, height, options, width]);

  const { error: updateError } = useAsync(async () => {
    if (!sendWrapperRef.current) {
      return;
    }

    // first time initialization
    if (!initialized.current) {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      if (!("transferControlToOffscreen" in canvas)) {
        throw new Error("Chart requires browsers with offscreen canvas support");
      }

      const newUpdateMessage = getNewUpdateMessage();
      if (!newUpdateMessage) {
        return;
      }

      initialized.current = true;

      const offscreenCanvas = canvas.transferControlToOffscreen();
      const scales = await sendWrapperRef.current<RpcScales>(
        "initialize",
        {
          node: offscreenCanvas,
          type,
          data: newUpdateMessage?.data,
          options: newUpdateMessage?.options,
          devicePixelRatio,
          width: newUpdateMessage?.width,
          height: newUpdateMessage?.height,
        },
        [offscreenCanvas],
      );

      if (!isMounted()) {
        return;
      }

      // once we are initialized, we can allow other handlers to send to the rpc endpoint
      rpcSendRef.current = sendWrapperRef.current;

      maybeUpdateScales(scales);
      onChartUpdate?.();
      return;
    }

    if (!rpcSendRef.current) {
      return;
    }

    const newUpdateMessage = getNewUpdateMessage();
    if (!newUpdateMessage) {
      return;
    }

    const scales = await rpcSendRef.current<RpcScales>("update", newUpdateMessage);
    if (!isMounted()) {
      return;
    }

    maybeUpdateScales(scales);
    onChartUpdate?.();
  }, [getNewUpdateMessage, isMounted, maybeUpdateScales, onChartUpdate, type]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !panEnabled) {
      return;
    }

    const hammerManager = new Hammer.Manager(canvas);
    const threshold = props.options.plugins?.zoom?.pan?.threshold ?? 10;
    hammerManager.add(new Hammer.Pan({ threshold }));

    hammerManager.on("panstart", async (event) => {
      if (!rpcSendRef.current) {
        return;
      }

      const boundingRect = event.target.getBoundingClientRect();
      await rpcSendRef.current<RpcScales>("panstart", {
        event: {
          cancelable: false,
          deltaY: event.deltaY,
          deltaX: event.deltaX,
          center: {
            x: event.center.x,
            y: event.center.y,
          },
          target: {
            boundingClientRect: boundingRect.toJSON(),
          },
        },
      });
    });

    hammerManager.on("panmove", async (event) => {
      if (!rpcSendRef.current) {
        return;
      }

      const boundingRect = event.target.getBoundingClientRect();
      const scales = await rpcSendRef.current<RpcScales>("panmove", {
        event: {
          cancelable: false,
          deltaY: event.deltaY,
          deltaX: event.deltaX,
          target: {
            boundingClientRect: boundingRect.toJSON(),
          },
        },
      });
      maybeUpdateScales(scales, { userInteraction: true });
    });

    hammerManager.on("panend", async (event) => {
      if (!rpcSendRef.current) {
        return;
      }

      const boundingRect = event.target.getBoundingClientRect();
      const scales = await rpcSendRef.current<RpcScales>("panend", {
        event: {
          cancelable: false,
          deltaY: event.deltaY,
          deltaX: event.deltaX,
          target: {
            boundingClientRect: boundingRect.toJSON(),
          },
        },
      });
      maybeUpdateScales(scales, { userInteraction: true });
    });

    return () => {
      hammerManager.destroy();
    };
  }, [maybeUpdateScales, panEnabled, props.options.plugins?.zoom?.pan?.threshold]);

  const onWheel = useCallback(
    async (event: React.WheelEvent<HTMLCanvasElement>) => {
      if (!zoomEnabled || !rpcSendRef.current) {
        return;
      }

      const boundingRect = event.currentTarget.getBoundingClientRect();
      const scales = await rpcSendRef.current<RpcScales>("wheel", {
        event: {
          cancelable: false,
          deltaY: event.deltaY,
          deltaX: event.deltaX,
          clientX: event.clientX,
          clientY: event.clientY,
          target: {
            boundingClientRect: boundingRect.toJSON(),
          },
        },
      });
      maybeUpdateScales(scales, { userInteraction: true });
    },
    [zoomEnabled, maybeUpdateScales],
  );

  const onMouseDown = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!rpcSendRef.current) {
        return;
      }

      const scales = await rpcSendRef.current<RpcScales>("mousedown", {
        event: rpcMouseEvent(event),
      });

      maybeUpdateScales(scales);
    },
    [maybeUpdateScales],
  );

  const onMouseUp = useCallback(async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rpcSendRef.current) {
      return;
    }

    return await rpcSendRef.current("mouseup", {
      event: rpcMouseEvent(event),
    });
  }, []);

  // Since hover events are handled via rpc, we might get a response back when we've
  // already hovered away from the chart. We gate calling onHover by whether the mouse is still
  // present on the component
  const mousePresentRef = useRef(false);

  const { onHover } = props;
  const onMouseMove = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (onHover && mousePresentRef.current) {
        if (!rpcSendRef.current) {
          return;
        }

        const elements = await rpcSendRef.current<RpcElement[]>("getElementsAtEvent", {
          event: rpcMouseEvent(event),
        });

        if (!isMounted() || !mousePresentRef.current) {
          return;
        }

        onHover(elements);
      }
    },
    [onHover, isMounted],
  );

  const onMouseEnter = useCallback(() => {
    mousePresentRef.current = true;
  }, []);

  const onMouseLeave = useCallback(() => {
    mousePresentRef.current = false;
    onHover?.([]);
  }, [onHover]);

  const onClick = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>): Promise<void> => {
      if (!props.onClick || !rpcSendRef.current) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // maybe we should forward the click event and add support for datalabel listeners
      // the rpc channel doesn't have a way to send rpc back...
      const datalabel = await rpcSendRef.current("getDatalabelAtEvent", {
        event: { x: mouseX, y: mouseY, type: "click" },
      });

      if (!isMounted()) {
        return;
      }

      let xVal: number | undefined;
      let yVal: number | undefined;

      const xScale = currentScalesRef.current?.x;
      if (xScale) {
        const pixels = xScale.pixelMax - xScale.pixelMin;
        const range = xScale.max - xScale.min;
        xVal = (range / pixels) * (mouseX - xScale.pixelMin) + xScale.min;
      }

      const yScale = currentScalesRef.current?.y;
      if (yScale) {
        const pixels = yScale.pixelMax - yScale.pixelMin;
        const range = yScale.max - yScale.min;
        yVal = (range / pixels) * (mouseY - yScale.pixelMin) + yScale.min;
      }

      props.onClick?.({
        datalabel,
        x: xVal,
        y: yVal,
      });
    },
    [isMounted, props],
  );

  if (updateError) {
    throw updateError;
  }

  return (
    <canvas
      ref={canvasRef}
      height={height}
      width={width}
      onWheel={onWheel}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
      onMouseUp={onMouseUp}
      style={{ width, height }}
    />
  );
}

export default Chart;
