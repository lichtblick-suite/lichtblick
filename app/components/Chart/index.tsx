// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ChartOptions, ChartData } from "chart.js";
import Hammer from "hammerjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { RpcElement, RpcScales } from "@foxglove-studio/app/components/Chart/types";
import WebWorkerManager from "@foxglove-studio/app/util/WebWorkerManager";

// Webworker Manager wants a constructor so we need to have a "class" wrapper
class ChartJSWorker {
  constructor() {
    return new Worker(new URL("./worker/main", import.meta.url));
  }
}

type OnClickArg = {
  datalabel?: unknown;
  // x-value in scale
  x: number | undefined;
  // y-value in scale
  y: number | undefined;
};

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

const webWorkerManager = new WebWorkerManager(ChartJSWorker, 4);

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

// Chart component renders data using workers with chartjs offscreen canvas
function Chart(props: Props) {
  const [id] = useState(uuidv4());
  const initialized = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(ReactNull);
  const [currentScales, setScales] = useState<RpcScales | undefined>(undefined);
  const userInteraction = useRef(false);

  // to avoid changing useCallback deps for callbacks which access the scale value
  // at the time they are invoked
  const currentScalesRef = useRef<RpcScales | undefined>();

  const zoomEnabled = props.options.plugins?.zoom?.zoom?.enabled ?? false;
  const panEnabled = props.options.plugins?.zoom?.pan?.enabled ?? false;

  const { type, data, options, width, height } = props;

  const rpc = useMemo(() => {
    return webWorkerManager.registerWorkerListener(id);
  }, [id]);

  // helper function to send rpc to our worker - all invocations need an _id_ so we inject it here
  const rpcSend = useCallback(
    <T extends unknown>(topic: string, payload?: any, transferrables?: unknown[]) => {
      return rpc.send<T>(topic, { id, ...payload }, transferrables);
    },
    [id, rpc],
  );

  useEffect(() => {
    return () => {
      rpcSend("destroy");
      webWorkerManager.unregisterWorkerListener(id);
    };
  }, [id, rpcSend]);

  // trigger when scales update
  const onScalesUpdate = props.onScalesUpdate;

  const maybeUpdateScales = useCallback((newScales: RpcScales) => {
    setScales((oldScales) => {
      // cheap hack to only update the scales when the values change
      // avoids triggering handlers that depend on scales
      const oldStr = JSON.stringify(oldScales);
      const newStr = JSON.stringify(newScales);
      return oldStr === newStr ? oldScales : newScales;
    });
  }, []);

  // trigger when scales update
  useEffect(() => {
    currentScalesRef.current = currentScales;

    if (currentScales) {
      onScalesUpdate?.(currentScales, { userInteraction: userInteraction.current });
      userInteraction.current = false;
    }
  }, [onScalesUpdate, currentScales]);

  // first time initialization
  useEffect(() => {
    // initialization happens once - even if the props for this effect change
    if (initialized.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (!("transferControlToOffscreen" in canvas)) {
      throw new Error("Chart requires browsers with offscreen canvas support");
    }

    initialized.current = true;
    const offscreenCanvas = canvas.transferControlToOffscreen();

    (async function () {
      const scales = await rpcSend<RpcScales>(
        "initialize",
        {
          node: offscreenCanvas,
          type,
          data,
          options,
          devicePixelRatio,
          width,
          height,
        },
        [offscreenCanvas],
      );
      maybeUpdateScales(scales);
    })();
  }, [type, data, options, width, height, rpcSend, maybeUpdateScales]);

  // update chart on new changes
  const { onChartUpdate } = props;
  useEffect(() => {
    (async function () {
      const scales = await rpcSend<RpcScales>("update", {
        data,
        options,
        width,
        height,
      });
      maybeUpdateScales(scales);

      onChartUpdate?.();
    })();
  }, [data, height, maybeUpdateScales, onChartUpdate, options, rpcSend, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !panEnabled) {
      return;
    }

    const hammerManager = new Hammer.Manager(canvas);
    const threshold = props.options.plugins?.zoom?.pan?.threshold ?? 10;
    hammerManager.add(new Hammer.Pan({ threshold }));

    hammerManager.on("panstart", async (event) => {
      const boundingRect = event.target.getBoundingClientRect();
      await rpcSend<RpcScales>("panstart", {
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
      const boundingRect = event.target.getBoundingClientRect();
      const scales = await rpcSend<RpcScales>("panmove", {
        event: {
          cancelable: false,
          deltaY: event.deltaY,
          deltaX: event.deltaX,
          target: {
            boundingClientRect: boundingRect.toJSON(),
          },
        },
      });
      userInteraction.current = true;
      maybeUpdateScales(scales);
    });

    hammerManager.on("panend", async (event) => {
      const boundingRect = event.target.getBoundingClientRect();
      const scales = await rpcSend<RpcScales>("panend", {
        event: {
          cancelable: false,
          deltaY: event.deltaY,
          deltaX: event.deltaX,
          target: {
            boundingClientRect: boundingRect.toJSON(),
          },
        },
      });
      userInteraction.current = true;
      maybeUpdateScales(scales);
    });

    return () => {
      hammerManager.destroy();
    };
  }, [maybeUpdateScales, panEnabled, props.options.plugins?.zoom?.pan?.threshold, rpcSend]);

  const onWheel = useCallback(
    async (event: React.WheelEvent<HTMLCanvasElement>) => {
      if (!zoomEnabled) {
        return;
      }

      const boundingRect = event.currentTarget.getBoundingClientRect();
      const scales = await rpcSend<RpcScales>("wheel", {
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
      userInteraction.current = true;
      maybeUpdateScales(scales);
    },
    [zoomEnabled, rpcSend, maybeUpdateScales],
  );

  const onMouseDown = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      const scales = await rpcSend<RpcScales>("mousedown", {
        event: rpcMouseEvent(event),
      });

      maybeUpdateScales(scales);
    },
    [maybeUpdateScales, rpcSend],
  );

  const onMouseUp = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      rpcSend("mouseup", {
        event: rpcMouseEvent(event),
      });
    },
    [rpcSend],
  );

  const { onHover } = props;
  const onMouseMove = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (onHover) {
        const elements = await rpcSend<RpcElement[]>("getElementsAtEvent", {
          event: rpcMouseEvent(event),
        });
        onHover(elements);
      }
    },
    [rpcSend, onHover],
  );

  const onClick = useCallback(
    async (event: React.MouseEvent<HTMLCanvasElement>): Promise<void> => {
      if (!props.onClick) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // maybe we should forward the click event and add support for datalabel listeners
      // the rpc channel doesn't have a way to send rpc back...
      const datalabel = await rpcSend("getDatalabelAtEvent", {
        event: { x: mouseX, y: mouseY, type: "click" },
      });

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
        datalabel: datalabel,
        x: xVal,
        y: yVal,
      });
    },
    [props, rpcSend],
  );

  return (
    <canvas
      ref={canvasRef}
      height={height / devicePixelRatio}
      width={width / devicePixelRatio}
      id={id}
      onWheel={onWheel}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{ width, height }}
    />
  );
}

export default Chart;
