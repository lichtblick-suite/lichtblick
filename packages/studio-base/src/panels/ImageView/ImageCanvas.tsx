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

import { ContextualMenu } from "@fluentui/react";
import MagnifyIcon from "@mdi/svg/svg/magnify.svg";
import cx from "classnames";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  MouseEvent,
  useState,
  CSSProperties,
  useMemo,
} from "react";
import { useResizeDetector } from "react-resize-detector";
import { useAsync } from "react-use";
import styled from "styled-components";
import usePanZoom from "use-pan-and-zoom";
import { v4 as uuidv4 } from "uuid";

import KeyListener from "@foxglove/studio-base/components/KeyListener";
import { LegacyButton } from "@foxglove/studio-base/components/LegacyStyledComponents";
import { Item } from "@foxglove/studio-base/components/Menu";
import { MessageEvent, Topic } from "@foxglove/studio-base/players/types";
import { CompressedImage, Image } from "@foxglove/studio-base/types/Messages";
import WebWorkerManager from "@foxglove/studio-base/util/WebWorkerManager";
import { downloadFiles } from "@foxglove/studio-base/util/download";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

import styles from "./ImageCanvas.module.scss";
import { Config, SaveImagePanelConfig } from "./index";
import { renderImage } from "./renderImage";
import { Dimensions, RawMarkerData, RenderOptions } from "./util";

type OnFinishRenderImage = () => void;
type Props = {
  topic?: Topic;
  image?: MessageEvent<unknown>;
  rawMarkerData: RawMarkerData;
  config: Config;
  saveConfig: SaveImagePanelConfig;
  onStartRenderImage: () => OnFinishRenderImage;
  renderInMainThread?: boolean;
};

const SErrorMessage = styled.div`
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  color: ${colors.RED2};
`;

const webWorkerManager = new WebWorkerManager(() => {
  return new Worker(new URL("ImageCanvas.worker", import.meta.url));
}, 1);

type RenderImage = (args: {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  zoomMode: "fit" | "fill" | "other";
  panZoom: { x: number; y: number; scale: number };
  viewport: { width: number; height: number };
  imageMessage?: Image | CompressedImage;
  imageMessageDatatype?: string;
  rawMarkerData: RawMarkerData;
  options?: RenderOptions;
}) => Promise<Dimensions | undefined>;

export default function ImageCanvas(props: Props): JSX.Element {
  const {
    rawMarkerData,
    topic,
    image,
    config,
    saveConfig,
    renderInMainThread,
    onStartRenderImage,
  } = props;
  const { mode } = config;

  // generic errors within the panel
  const [error, setError] = useState<Error | undefined>();

  const [zoomMode, setZoomMode] = useState<Config["mode"]>(mode);

  const canvasRef = useRef<HTMLCanvasElement>(ReactNull);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // and existing resize observation.
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

  // the canvas can only be transferred once, so we keep the transfer around
  const transfferedCanvasRef = useRef<OffscreenCanvas | undefined>(undefined);

  // setup the render function to render in the main thread or in the worker
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const id = uuidv4();

    if (renderInMainThread === true) {
      // Potentially performance-sensitive; await can be expensive
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      const renderInMain = (args: {
        canvas: HTMLCanvasElement | OffscreenCanvas;
        zoomMode: "fit" | "fill" | "other";
        panZoom: { x: number; y: number; scale: number };
        viewport: { width: number; height: number };
        imageMessage?: Image | CompressedImage;
        imageMessageDatatype?: string;
        rawMarkerData: RawMarkerData;
        options?: RenderOptions;
      }) => {
        const targetWidth = args.viewport.width;
        const targetHeight = args.viewport.height;

        if (targetWidth !== canvas.width) {
          canvas.width = targetWidth;
        }
        if (targetHeight !== canvas.height) {
          canvas.height = targetHeight;
        }
        return renderImage(args);
      };

      setDoRenderImage(() => renderInMain);
    } else {
      const worker = webWorkerManager.registerWorkerListener(id);

      // Potentially performance-sensitive; await can be expensive
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      const workerRender = (args: {
        canvas: HTMLCanvasElement | OffscreenCanvas;
        zoomMode: "fit" | "fill" | "other";
        panZoom: { x: number; y: number; scale: number };
        viewport: { width: number; height: number };
        imageMessage?: Image | CompressedImage;
        imageMessageDatatype?: string;
        rawMarkerData: RawMarkerData;
        options?: RenderOptions;
      }) => {
        const {
          zoomMode: zoom,
          panZoom,
          viewport,
          imageMessage,
          imageMessageDatatype,
          rawMarkerData: rawMarkers,
          options,
        } = args;

        if (!imageMessage) {
          return Promise.resolve(undefined);
        }

        // Create a payload based on whether the image is a compressed image (format field present)
        // or a regular uncompressed image
        const msg =
          "format" in imageMessage
            ? {
                data: imageMessage.data,
                format: imageMessage.format,
              }
            : {
                data: imageMessage.data,
                width: imageMessage.width,
                height: imageMessage.height,
                encoding: imageMessage.encoding,
                is_bigendian: imageMessage.is_bigendian,
              };

        return worker.send<Dimensions | undefined>("renderImage", {
          id,
          zoomMode: zoom,
          panZoom,
          viewport,
          imageMessage: msg,
          imageMessageDatatype,
          rawMarkerData: JSON.parse(JSON.stringify(rawMarkers)),
          options,
        });
      };

      transfferedCanvasRef.current ??= canvas.transferControlToOffscreen();

      worker
        .send<void>("initialize", { id, canvas: transfferedCanvasRef.current }, [
          transfferedCanvasRef.current,
        ])
        .then(() => {
          setDoRenderImage(() => workerRender);
        })
        .catch((err) => {
          setError(err);
        });
    }

    return () => {
      if (renderInMainThread === true) {
        return;
      }

      webWorkerManager.unregisterWorkerListener(id);
    };
  }, [renderInMainThread]);

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
    initialPan: config.pan,
    initialZoom: config.zoom,
  });

  useLayoutEffect(() => {
    if (canvasRef.current) {
      setContainer(canvasRef.current);
    }
  }, [setContainer]);

  const renderOptions = useMemo(() => {
    return {
      imageSmoothing: config.smooth,
      minValue: config.minValue,
      maxValue: config.maxValue,
    };
  }, [config.minValue, config.maxValue, config.smooth]);

  const devicePixelRatio = window.devicePixelRatio;
  const { error: renderError } = useAsync(async () => {
    if (!canvasRef.current || !doRenderImage) {
      return;
    }

    // we haven't detected a width/height yet so avoid rendering
    if (width == undefined || height == undefined) {
      return;
    }

    // can't set width/height of canvas after transferring control to offscreen
    // so we need to send the width/height to rpc
    const targetWidth = width * devicePixelRatio;
    const targetHeight = height * devicePixelRatio;

    const computedViewbox = {
      x: panX * devicePixelRatio,
      y: panY * devicePixelRatio,
      scale: scaleValue,
    };

    const imageMessage = image?.message as Image | CompressedImage | undefined;
    if (!imageMessage) {
      return;
    }

    const finishRender = onStartRenderImage();
    try {
      return await doRenderImage({
        canvas: canvasRef.current ?? undefined,
        zoomMode: zoomMode ?? "fit",
        panZoom: computedViewbox,
        viewport: { width: targetWidth, height: targetHeight },
        imageMessage,
        imageMessageDatatype: topic?.datatype,
        rawMarkerData,
        options: renderOptions,
      });
    } finally {
      finishRender();
    }
  }, [
    doRenderImage,
    width,
    height,
    devicePixelRatio,
    panX,
    panY,
    scaleValue,
    image?.message,
    onStartRenderImage,
    zoomMode,
    topic?.datatype,
    rawMarkerData,
    renderOptions,
  ]);

  const [openZoomContext, setOpenZoomContext] = useState(false);

  const zoomIn = useCallback(() => {
    setZoom((oldZoom) => oldZoom * 1.1);
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    setZoom((oldZoom) => oldZoom * 0.9);
  }, [setZoom]);

  const resetPanZoom = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [setPan, setZoom]);

  const onZoomFit = useCallback(() => {
    setZoomMode("fit");
    resetPanZoom();
    setOpenZoomContext(false);
  }, [resetPanZoom]);

  const onZoomFill = useCallback(() => {
    setZoomMode("fill");
    resetPanZoom();
    setOpenZoomContext(false);
  }, [resetPanZoom]);

  const onZoom100 = useCallback(() => {
    setZoomMode("other");
    resetPanZoom();
    setOpenZoomContext(false);
  }, [resetPanZoom]);

  useLayoutEffect(() => {
    saveConfig({
      pan: { x: panX, y: panY },
      zoom: scaleValue,
    });
  }, [panX, panY, saveConfig, scaleValue]);

  const zoomContextMenu = useMemo(() => {
    return (
      <div className={styles.zoomContextMenu} data-zoom-menu>
        <div className={cx(styles.menuItem, styles.notInteractive)}>
          Scroll or use the buttons below to zoom
        </div>
        <div className={cx(styles.menuItem, styles.borderBottom)}>
          <LegacyButton className={styles.round} onClick={zoomOut} data-panel-minus-zoom>
            -
          </LegacyButton>
          <LegacyButton className={styles.round} onClick={zoomIn} data-panel-add-zoom>
            +
          </LegacyButton>
        </div>
        <Item className={styles.borderBottom} onClick={onZoom100} dataTest={"hundred-zoom"}>
          Zoom to 100%
        </Item>
        <Item className={styles.borderBottom} onClick={onZoomFit} dataTest={"fit-zoom"}>
          Zoom to fit
        </Item>
        <Item onClick={onZoomFill} dataTest={"fill-zoom"}>
          Zoom to fill
        </Item>
      </div>
    );
  }, [onZoom100, onZoomFill, onZoomFit, zoomIn, zoomOut]);

  const [contextMenuEvent, setContextMenuEvent] = useState<
    MouseEvent<HTMLCanvasElement>["nativeEvent"] | undefined
  >(undefined);

  const onCanvasContextMenu = useCallback((ev: MouseEvent<HTMLCanvasElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    setContextMenuEvent(ev.nativeEvent);
  }, []);

  const onDownloadImage = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas || !image || !topic) {
      return;
    }

    const imageMessage = image.message as Image | CompressedImage | undefined;
    if (!imageMessage) {
      return;
    }

    // re-render the image onto a new canvas to download the original image
    const tempCanvas = document.createElement("canvas");
    void renderImage({
      canvas: tempCanvas,
      zoomMode: "other",
      panZoom: { x: 0, y: 0, scale: 1 },
      imageMessage,
      imageMessageDatatype: topic.datatype,
      rawMarkerData: { markers: [], transformMarkers: false },
      options: { ...renderOptions, resizeCanvas: true },
    }).then((dimensions) => {
      if (!dimensions) {
        return;
      }

      // context: https://stackoverflow.com/questions/37135417/download-canvas-as-png-in-fabric-js-giving-network-error
      // read the canvas data as an image (png)
      tempCanvas.toBlob((blob) => {
        if (!blob) {
          setError(
            new Error(`Failed to create an image from ${canvas.width}x${canvas.height} canvas`),
          );
          return;
        }
        // name the image the same name as the topic
        // note: the / characters in the file name will be replaced with _ by the browser
        // remove the leading / so the image name doesn't start with _
        const topicName = topic.name.slice(1);
        const stamp = getTimestampForMessage(image.message) ?? { sec: 0, nsec: 0 };
        const fileName = `${topicName}-${stamp.sec}-${stamp.nsec}`;
        downloadFiles([{ blob, fileName }]);
      }, "image/png");
    });
  }, [image, topic, renderOptions]);

  const keyDownHandlers = useMemo(() => {
    return {
      "=": zoomIn,
      "-": zoomOut,
      "0": onZoom100,
    };
  }, [onZoom100, zoomIn, zoomOut]);

  const style: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    imageRendering: config.smooth === true ? "auto" : "pixelated",
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <KeyListener keyDownHandlers={keyDownHandlers} />
      {error && <SErrorMessage>Error: {error.message}</SErrorMessage>}
      {renderError && <SErrorMessage>Error: {renderError.message}</SErrorMessage>}
      <canvas
        onContextMenu={onCanvasContextMenu}
        {...panZoomHandlers}
        style={style}
        ref={canvasRef}
      />
      {contextMenuEvent && (
        <ContextualMenu
          target={contextMenuEvent}
          onDismiss={() => setContextMenuEvent(undefined)}
          items={[{ key: "download", text: "Download Image", onClick: onDownloadImage }]}
        />
      )}
      {openZoomContext && zoomContextMenu}
      <LegacyButton
        className={styles.magnify}
        onClick={() => setOpenZoomContext((old) => !old)}
        data-magnify-icon
      >
        <MagnifyIcon />
      </LegacyButton>
    </div>
  );
}
