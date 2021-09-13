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

import { MessageEvent } from "@foxglove/studio-base/players/types";
import {
  Image,
  ImageMarker,
  Color,
  Point,
  CompressedImage,
  ImageMarkerArray,
} from "@foxglove/studio-base/types/Messages";
import sendNotification from "@foxglove/studio-base/util/sendNotification";

import PinholeCameraModel from "./PinholeCameraModel";
import {
  decodeYUV,
  decodeRGB8,
  decodeBGR8,
  decodeFloat1c,
  decodeBayerRGGB8,
  decodeBayerBGGR8,
  decodeBayerGBRG8,
  decodeBayerGRBG8,
  decodeMono8,
  decodeMono16,
} from "./decodings";
import { buildMarkerData, Dimensions, RawMarkerData, MarkerData, RenderOptions } from "./util";

const UNCOMPRESSED_IMAGE_DATATYPES = ["sensor_msgs/Image", "sensor_msgs/msg/Image"];
export const IMAGE_DATATYPES = [
  "sensor_msgs/Image",
  "sensor_msgs/msg/Image",
  "sensor_msgs/CompressedImage",
  "sensor_msgs/msg/CompressedImage",
];

// Just globally keep track of if we've shown an error in rendering, since typically when you get
// one error, you'd then get a whole bunch more, which is spammy.
let hasLoggedCameraModelError: boolean = false;

// Given a canvas, an image message, and marker info, render the image to the canvas.
export async function renderImage({
  canvas,
  zoomMode,
  panZoom,
  imageMessage,
  imageMessageDatatype,
  rawMarkerData,
  options,
}: {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  zoomMode: "fit" | "fill" | "other";
  panZoom: { x: number; y: number; scale: number };
  imageMessage?: Image | CompressedImage;
  imageMessageDatatype?: string;
  rawMarkerData: RawMarkerData;
  options?: RenderOptions;
}): Promise<Dimensions | undefined> {
  if (!imageMessage || imageMessageDatatype == undefined) {
    clearCanvas(canvas);
    return undefined;
  }

  const { imageSmoothing = false } = options ?? {};

  let markerData = undefined;
  try {
    markerData = buildMarkerData(rawMarkerData);
  } catch (error) {
    if (!hasLoggedCameraModelError) {
      sendNotification(`Failed to initialize camera model from CameraInfo`, error, "user", "warn");
      hasLoggedCameraModelError = true;
    }
  }

  try {
    const bitmap = await decodeMessageToBitmap(imageMessage, imageMessageDatatype, options);

    if (options?.resizeCanvas === true) {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
    }

    const dimensions = render({ canvas, zoomMode, panZoom, bitmap, imageSmoothing, markerData });
    bitmap.close();
    return dimensions;
  } catch (error) {
    // If there is an error, clear the image and re-throw it.
    clearCanvas(canvas);
    throw error;
  }
}

function toRGBA(color: Color) {
  const { r, g, b, a } = color;
  return `rgba(${r}, ${g}, ${b}, ${a !== 0 ? a : 1})`;
}

// Note: Return type is inexact -- may contain z.
function maybeUnrectifyPoint(
  cameraModel: PinholeCameraModel | undefined,
  point: Point,
): Readonly<{ x: number; y: number }> {
  if (cameraModel) {
    return cameraModel.unrectifyPoint(point);
  }
  return point;
}

// Potentially performance-sensitive; await can be expensive
// eslint-disable-next-line @typescript-eslint/promise-function-async
function decodeMessageToBitmap(
  imageMessage: Partial<Image> | Partial<CompressedImage>,
  datatype: string,
  options: RenderOptions = {},
): Promise<ImageBitmap> {
  let image: ImageData | HTMLImageElement | Blob;
  const { data: rawData } = imageMessage;
  if (!(rawData instanceof Uint8Array)) {
    throw new Error("Message must have data of type Uint8Array");
  }

  // In a Websocket context, we don't know whether the message is compressed or
  // raw. Our subscription interface for the WebsocketPlayer can request
  // compressed verisons of topics, in which case the message datatype can
  // differ from the one recorded during initialization. So here we just check
  // for properties consistent with either datatype, and render accordingly.
  if (
    UNCOMPRESSED_IMAGE_DATATYPES.includes(datatype) &&
    "encoding" in imageMessage &&
    imageMessage.encoding
  ) {
    const { is_bigendian, width, height, encoding } = imageMessage as Image;
    image = new ImageData(width, height);
    switch (encoding) {
      case "yuv422":
        decodeYUV(rawData as unknown as Int8Array, width, height, image.data);
        break;
      case "rgb8":
        decodeRGB8(rawData, width, height, image.data);
        break;
      case "bgr8":
      case "8UC3":
        decodeBGR8(rawData, width, height, image.data);
        break;
      case "32FC1":
        decodeFloat1c(rawData, width, height, is_bigendian, image.data);
        break;
      case "bayer_rggb8":
        decodeBayerRGGB8(rawData, width, height, image.data);
        break;
      case "bayer_bggr8":
        decodeBayerBGGR8(rawData, width, height, image.data);
        break;
      case "bayer_gbrg8":
        decodeBayerGBRG8(rawData, width, height, image.data);
        break;
      case "bayer_grbg8":
        decodeBayerGRBG8(rawData, width, height, image.data);
        break;
      case "mono8":
      case "8UC1":
        decodeMono8(rawData, width, height, image.data);
        break;
      case "mono16":
      case "16UC1":
        decodeMono16(rawData, width, height, is_bigendian, image.data, options);
        break;
      default:
        throw new Error(`Unsupported encoding ${encoding}`);
    }
  } else if (
    IMAGE_DATATYPES.includes(datatype) ||
    ("format" in imageMessage && imageMessage.format)
  ) {
    const { format } = imageMessage as CompressedImage;
    image = new Blob([rawData], { type: `image/${format}` });
  } else {
    throw new Error(`Message type is not usable for rendering images.`);
  }

  return self.createImageBitmap(image);
}

function clearCanvas(canvas?: HTMLCanvasElement | OffscreenCanvas) {
  if (canvas) {
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function render({
  canvas,
  zoomMode,
  panZoom,
  bitmap,
  imageSmoothing,
  markerData,
}: {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  zoomMode: "fit" | "fill" | "other";
  panZoom: { x: number; y: number; scale: number };
  bitmap: ImageBitmap;
  imageSmoothing: boolean;
  markerData: MarkerData | undefined;
}): Dimensions | undefined {
  const bitmapDimensions = { width: bitmap.width, height: bitmap.height };
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.imageSmoothingEnabled = imageSmoothing;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { markers = [], cameraModel } = markerData ?? {};

  const viewportW = canvas.width;
  const viewportH = canvas.height;

  let imageViewportScale = viewportW / bitmap.width;

  const calculatedHeight = bitmap.height * imageViewportScale;

  // if we are trying to fit and the height exeeds viewport, we need to scale on height
  if (zoomMode === "fit" && calculatedHeight > viewportH) {
    imageViewportScale = viewportH / bitmap.height;
  }

  // if we are trying to fill and the height doesn't fill viewport, we need to scale on height
  if (zoomMode === "fill" && calculatedHeight < viewportH) {
    imageViewportScale = viewportH / bitmap.height;
  }

  if (zoomMode === "other") {
    imageViewportScale = 1;
  }

  ctx.save();

  // translate x/y from the center of the canvas
  ctx.translate(viewportW / 2, viewportH / 2);
  ctx.translate(panZoom.x, panZoom.y);

  ctx.scale(panZoom.scale, panZoom.scale);
  ctx.scale(imageViewportScale, imageViewportScale);

  // center the image in the viewport
  // also sets 0,0 as the upper left corner of the image since markers are drawn from 0,0 on the image
  ctx.translate(-bitmap.width / 2, -bitmap.height / 2);

  ctx.drawImage(bitmap, 0, 0);

  // The bitmap images from the image message may be resized to conserve space
  // while the markers are positioned relative to the original image size.
  // Original width/height are the image dimensions for the marker positions
  // These dimensions are used to scale the markers positions separately from the bitmap size
  const { originalWidth = bitmap.width, originalHeight = bitmap.height } = markerData ?? {};
  ctx.scale(bitmap.width / originalWidth, bitmap.height / originalHeight);

  try {
    paintMarkers(ctx, markers as MessageEvent<ImageMarker | ImageMarkerArray>[], cameraModel);
  } catch (err) {
    console.warn("error painting markers:", err);
  } finally {
    ctx.restore();
  }
  return bitmapDimensions;
}

function paintMarkers(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  messages: MessageEvent<ImageMarker | ImageMarkerArray>[],
  cameraModel: PinholeCameraModel | undefined,
) {
  for (const { message } of messages) {
    ctx.save();
    try {
      if (Array.isArray((message as Partial<ImageMarkerArray>).markers)) {
        for (const marker of (message as ImageMarkerArray).markers) {
          paintMarker(ctx, marker, cameraModel);
        }
      } else {
        paintMarker(ctx, message as ImageMarker, cameraModel);
      }
    } catch (e) {
      console.error("Unable to paint marker to ImageView", e, message);
    } finally {
      ctx.restore();
    }
  }
}

function paintMarker(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  marker: ImageMarker,
  cameraModel: PinholeCameraModel | undefined,
) {
  switch (marker.type) {
    case 0: {
      // CIRCLE
      ctx.beginPath();
      const { x, y } = maybeUnrectifyPoint(cameraModel, marker.position);
      ctx.arc(x, y, marker.scale, 0, 2 * Math.PI);
      if (marker.thickness <= 0) {
        ctx.fillStyle = toRGBA(marker.outline_color);
        ctx.fill();
      } else {
        ctx.lineWidth = marker.thickness;
        ctx.strokeStyle = toRGBA(marker.outline_color);
        ctx.stroke();
      }
      break;
    }

    // LINE_LIST
    case 2:
      if (marker.points.length % 2 !== 0) {
        break;
      }

      ctx.strokeStyle = toRGBA(marker.outline_color);
      ctx.lineWidth = marker.thickness;

      for (let i = 0; i < marker.points.length; i += 2) {
        const { x: x1, y: y1 } = maybeUnrectifyPoint(cameraModel, marker.points[i] as Point);
        const { x: x2, y: y2 } = maybeUnrectifyPoint(cameraModel, marker.points[i + 1] as Point);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      break;

    // LINE_STRIP, POLYGON
    case 1:
    case 3: {
      if (marker.points.length === 0) {
        break;
      }
      ctx.beginPath();
      const { x, y } = maybeUnrectifyPoint(cameraModel, marker.points[0] as Point);
      ctx.moveTo(x, y);
      for (let i = 1; i < marker.points.length; i++) {
        const maybeUnrectifiedPoint = maybeUnrectifyPoint(cameraModel, marker.points[i] as Point);
        ctx.lineTo(maybeUnrectifiedPoint.x, maybeUnrectifiedPoint.y);
      }
      if (marker.type === 3) {
        ctx.closePath();
      }
      if (marker.thickness <= 0) {
        ctx.fillStyle = toRGBA(marker.outline_color);
        ctx.fill();
      } else {
        ctx.strokeStyle = toRGBA(marker.outline_color);
        ctx.lineWidth = marker.thickness;
        ctx.stroke();
      }
      break;
    }

    case 4: {
      // POINTS
      if (marker.points.length === 0) {
        break;
      }

      const size = marker.scale !== 0 ? marker.scale : 4;
      if (marker.outline_colors.length === marker.points.length) {
        for (let i = 0; i < marker.points.length; i++) {
          const { x, y } = maybeUnrectifyPoint(cameraModel, marker.points[i] as Point);
          ctx.fillStyle = toRGBA(marker.outline_colors[i] as Color);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, 2 * Math.PI);
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        for (let i = 0; i < marker.points.length; i++) {
          const { x, y } = maybeUnrectifyPoint(cameraModel, marker.points[i] as Point);
          ctx.arc(x, y, size, 0, 2 * Math.PI);
          ctx.closePath();
        }
        ctx.fillStyle = toRGBA(marker.fill_color);
        ctx.fill();
      }
      break;
    }

    case 5: {
      // TEXT (our own extension on visualization_msgs/Marker)
      const { x, y } = maybeUnrectifyPoint(cameraModel, marker.position);

      const fontSize = marker.scale * 12;
      const padding = 4 * marker.scale;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textBaseline = "bottom";
      if (marker.filled) {
        const metrics = ctx.measureText(marker.text.data);
        const height = fontSize * 1.2; // Chrome doesn't yet support height in TextMetrics
        ctx.fillStyle = toRGBA(marker.fill_color);
        ctx.fillRect(x, y - height, Math.ceil(metrics.width + 2 * padding), Math.ceil(height));
      }
      ctx.fillStyle = toRGBA(marker.outline_color);
      ctx.fillText(marker.text.data, x + padding, y);
      break;
    }

    default:
      console.warn("unrecognized image marker type", marker);
  }
}
