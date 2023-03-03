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

import { useCallback, useLayoutEffect, useRef, useState, useMemo, useReducer } from "react";
import { useResizeDetector } from "react-resize-detector";
import { useAsync } from "react-use";
import { makeStyles } from "tss-react/mui";
import usePanZoom from "use-pan-and-zoom";
import { v4 as uuidv4 } from "uuid";

import KeyListener from "@foxglove/studio-base/components/KeyListener";
import { Topic } from "@foxglove/studio-base/players/types";
import Rpc from "@foxglove/studio-base/util/Rpc";
import WebWorkerManager from "@foxglove/studio-base/util/WebWorkerManager";

import ZoomMenu from "./ZoomMenu";
import { renderImage } from "../lib/renderImage";
import { Config } from "../types";
import type {
  Dimensions,
  PixelData,
  RawMarkerData,
  RenderableCanvas,
  RenderArgs,
  NormalizedImageMessage,
} from "../types";

type OnFinishRenderImage = () => void;

type Props = {
  topic?: Topic;
  image?: NormalizedImageMessage;
  rawMarkerData: RawMarkerData;
  config: Config;
  saveConfig: (config: Partial<Config>) => void;
  onStartRenderImage: () => OnFinishRenderImage;
  renderInMainThread?: boolean;
  setActivePixelData: (data: PixelData | undefined) => void;
};

const useStyles = makeStyles()((theme) => ({
  root: {
    overflow: "hidden",
    width: "100%",
    height: "100%",
    position: "relative",
  },
  errorMessage: {
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.error.main,
  },
  canvasContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",

    canvas: {
      width: "100%",
      height: "100%",
      imageRendering: "pixelated",
    },
  },
  canvasImageRenderingSmooth: {
    canvas: {
      imageRendering: "auto",
    },
  },
}));

const webWorkerManager = new WebWorkerManager(() => {
  // foxglove-depcheck-used: babel-plugin-transform-import-meta
  return new Worker(new URL("ImageCanvas.worker", import.meta.url));
}, 1);

type RenderImage = (
  args: RenderArgs & { canvas: RenderableCanvas },
) => Promise<Dimensions | undefined>;

const supportsOffscreenCanvas =
  typeof HTMLCanvasElement.prototype.transferControlToOffscreen === "function";

export function ImageCanvas(props: Props): JSX.Element {
  const {
    rawMarkerData,
    image: normalizedImageMessage,
    config,
    saveConfig,
    onStartRenderImage,
  } = props;
  const { mode } = config;
  const { classes, cx } = useStyles();

  const renderInMainThread = (props.renderInMainThread ?? false) || !supportsOffscreenCanvas;

  const [_, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // generic errors within the panel
  const [error, setError] = useState<Error | undefined>();

  const [zoomMode, setZoomMode] = useState<Config["mode"]>(mode);

  const [canvas, setCanvas] = useState<HTMLCanvasElement | undefined>();
  const canvasContainerRef = useRef<HTMLDivElement>(ReactNull);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const {
    width,
    height,
    ref: rootRef,
  } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
  });

  // The render function dispatches rendering to the main thread or a worker
  const [doRenderImage, setDoRenderImage] = useState<RenderImage | undefined>(undefined);

  const workerRef = useRef<Rpc | undefined>();

  const [workerId] = useState(() => uuidv4());

  // setup the render function to render in the main thread or in the worker
  useLayoutEffect(() => {
    const newCanvas = document.createElement("canvas");
    setCanvas(newCanvas);
    canvasContainerRef.current?.appendChild(newCanvas);

    let mounted = true;
    const id = workerId;

    if (renderInMainThread) {
      // Potentially performance-sensitive; await can be expensive
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      const renderInMain: RenderImage = (args) => {
        const targetWidth = args.geometry.viewport.width;
        const targetHeight = args.geometry.viewport.height;

        if (targetWidth !== newCanvas.width) {
          newCanvas.width = targetWidth;
        }
        if (targetHeight !== newCanvas.height) {
          newCanvas.height = targetHeight;
        }
        return renderImage({ ...args, hitmapCanvas: undefined });
      };

      setDoRenderImage(() => renderInMain);
    } else {
      const worker = webWorkerManager.registerWorkerListener(id);
      workerRef.current = worker;

      // Potentially performance-sensitive; await can be expensive
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      const workerRender: RenderImage = (args) => {
        const { geometry, imageMessage, options, rawMarkerData: rawMarkers } = args;

        return worker.send<Dimensions | undefined, RenderArgs & { id: string }>("renderImage", {
          geometry,
          id,
          imageMessage,
          options,
          rawMarkerData: rawMarkers,
        });
      };

      const transferredCanvas = newCanvas.transferControlToOffscreen();

      worker
        .send<void>("initialize", { id, canvas: transferredCanvas }, [transferredCanvas])
        .then(() => {
          if (mounted) {
            setDoRenderImage(() => workerRender);
          }
        })
        .catch((err) => {
          if (mounted) {
            console.error(err);
            setError(err as Error);
          }
        });
    }

    return () => {
      mounted = false;
      newCanvas.remove();
      if (renderInMainThread) {
        return;
      }

      workerRef.current = undefined;
      webWorkerManager.unregisterWorkerListener(id);
    };
  }, [renderInMainThread, workerId]);

  const {
    setPan,
    setZoom,
    // panX/panY need to be split apart because the pan object's identity may change on each render,
    // and we want to avoid unnecessary updates to useEffects/useMemos below
    pan: { x: panX, y: panY },
    zoom: scaleValue,
    setContainer,
    panZoomHandlers,
  } = usePanZoom({
    minZoom: 0.5,
    initialPan: config.pan,
    initialZoom: config.zoom,
  });

  useLayoutEffect(() => {
    if (canvas) {
      setContainer(canvas);
    }
  }, [canvas, setContainer]);

  const renderOptions = useMemo(() => {
    return {
      imageSmoothing: config.smooth,
      minValue: config.minValue,
      maxValue: config.maxValue,
    };
  }, [config.minValue, config.maxValue, config.smooth]);

  const devicePixelRatio = window.devicePixelRatio;
  const { error: renderError } = useAsync(async () => {
    if (!canvas || !doRenderImage) {
      return;
    }

    // we haven't detected a width/height yet so avoid rendering
    if (width == undefined || height == undefined) {
      return;
    }

    // can't set width/height of canvas after transferring control to offscreen
    // so we need to send the width/height to rpc
    const targetWidth = Math.floor(width * devicePixelRatio);
    const targetHeight = Math.floor(height * devicePixelRatio);

    const computedViewbox = {
      x: Math.floor(panX * devicePixelRatio),
      y: Math.floor(panY * devicePixelRatio),
      scale: scaleValue,
    };

    const finishRender = onStartRenderImage();
    try {
      return await doRenderImage({
        canvas,
        geometry: {
          flipHorizontal: config.flipHorizontal ?? false,
          flipVertical: config.flipVertical ?? false,
          panZoom: computedViewbox,
          rotation: config.rotation ?? 0,
          viewport: { width: targetWidth, height: targetHeight },
          zoomMode: zoomMode ?? "fit",
        },
        imageMessage: normalizedImageMessage,
        rawMarkerData,
        options: renderOptions,
      });
    } finally {
      finishRender();
    }
  }, [
    canvas,
    config.flipHorizontal,
    config.flipVertical,
    config.rotation,
    devicePixelRatio,
    doRenderImage,
    height,
    normalizedImageMessage,
    onStartRenderImage,
    panX,
    panY,
    rawMarkerData,
    renderOptions,
    scaleValue,
    width,
    zoomMode,
  ]);

  useLayoutEffect(() => {
    saveConfig({
      pan: { x: panX, y: panY },
      zoom: scaleValue,
    });
  }, [panX, panY, saveConfig, scaleValue]);

  const onCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const setActivePixelData = props.setActivePixelData;
      const boundingRect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - boundingRect.x;
      const y = event.clientY - boundingRect.y;
      void workerRef.current
        ?.send<PixelData | undefined>("mouseMove", {
          id: workerId,
          x: x * devicePixelRatio,
          y: y * devicePixelRatio,
        })
        .then((r) => {
          if (r?.marker) {
            setActivePixelData(r);
          } else {
            setActivePixelData(undefined);
          }
        });
    },
    [devicePixelRatio, props.setActivePixelData, workerId],
  );

  const resetPanZoom = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    // We have to force an update here becase pan & zoom are not state
    // variables and setting them alone will not trigger a re-render.
    forceUpdate();
  }, [setPan, setZoom]);

  const zoomIn = useCallback(() => {
    setZoom((oldZoom) => oldZoom + 1 * 0.5);
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    setZoom((oldZoom) => oldZoom - 1 * 0.5);
  }, [setZoom]);

  const onZoom100 = useCallback(() => {
    setZoomMode("other");
    resetPanZoom();
  }, [resetPanZoom, setZoomMode]);

  const keyDownHandlers = useMemo(() => {
    return {
      "=": zoomIn,
      "-": zoomOut,
      "0": onZoom100,
    };
  }, [onZoom100, zoomIn, zoomOut]);

  // We have to set tabIndex here so we can be focused and receive keyboard events.
  return (
    <div ref={rootRef} className={classes.root} tabIndex={0}>
      <KeyListener keyDownHandlers={keyDownHandlers} />
      {error && <div className={classes.errorMessage}>Error: {error.message}</div>}
      {renderError && <div className={classes.errorMessage}>Error: {renderError.message}</div>}
      <ZoomMenu
        zoom={scaleValue}
        setZoom={setZoom}
        setZoomMode={setZoomMode}
        resetPanZoom={resetPanZoom}
      />
      <div
        ref={canvasContainerRef}
        onClick={onCanvasClick}
        className={cx(classes.canvasContainer, {
          [classes.canvasImageRenderingSmooth]: config.smooth === true,
        })}
        {...panZoomHandlers}
      />
    </div>
  );
}
