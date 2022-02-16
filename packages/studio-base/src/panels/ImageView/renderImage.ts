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
  ImageMarker,
  Color,
  ImageMarkerArray,
  ImageMarkerType,
  Point2D,
} from "@foxglove/studio-base/types/Messages";
import sendNotification from "@foxglove/studio-base/util/sendNotification";

import { HitmapRenderContext } from "./HitmapRenderContext";
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
import { NormalizedImageMessage } from "./normalizeMessage";
import type {
  MarkerData,
  PanZoom,
  RenderableCanvas,
  RenderArgs,
  RenderDimensions,
  RenderGeometry,
  RenderOptions,
} from "./types";
import { buildMarkerData, calculateZoomScale } from "./util";

// Just globally keep track of if we've shown an error in rendering, since typically when you get
// one error, you'd then get a whole bunch more, which is spammy.
let hasLoggedCameraModelError: boolean = false;

// Size threshold below which we do fast point rendering as rects.
// Empirically 3 seems like a good threshold here.
const FAST_POINT_SIZE_THRESHOlD = 3;

// Given a canvas, an image message, and marker info, render the image to the canvas.
export async function renderImage({
  canvas,
  hitmapCanvas,
  geometry,
  imageMessage,
  rawMarkerData,
  options,
}: RenderArgs & { canvas: RenderableCanvas; hitmapCanvas: RenderableCanvas | undefined }): Promise<
  RenderDimensions | undefined
> {
  if (!imageMessage) {
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
    const bitmap = await decodeMessageToBitmap(imageMessage, options);

    if (options?.resizeCanvas === true) {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
    }

    const dimensions = render({
      canvas,
      geometry,
      hitmapCanvas,
      bitmap,
      imageSmoothing,
      markerData,
    });
    bitmap.close();
    return dimensions;
  } catch (error) {
    // If there is an error, clear the image and re-throw it.
    clearCanvas(canvas);
    throw error;
  }
}

function toRGBA(color: Color) {
  return `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${color.a})`;
}

function maybeUnrectifyPoint(cameraModel: PinholeCameraModel | undefined, point: Point2D): Point2D {
  return cameraModel?.unrectifyPoint(point) ?? point;
}

// Potentially performance-sensitive; await can be expensive
// eslint-disable-next-line @typescript-eslint/promise-function-async
function decodeMessageToBitmap(
  imageMessage: NormalizedImageMessage,
  options: RenderOptions = {},
): Promise<ImageBitmap> {
  const { data: rawData } = imageMessage;
  if (!(rawData instanceof Uint8Array)) {
    throw new Error("Message must have data of type Uint8Array");
  }

  switch (imageMessage.type) {
    case "compressed": {
      const image = new Blob([rawData], { type: `image/${imageMessage.format}` });
      return self.createImageBitmap(image);
    }
    case "raw": {
      const { is_bigendian, width, height, encoding } = imageMessage;
      const image = new ImageData(width, height);
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
      return self.createImageBitmap(image);
    }
  }
}

function clearCanvas(canvas?: RenderableCanvas) {
  if (canvas) {
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function render({
  bitmap,
  canvas,
  geometry,
  hitmapCanvas,
  imageSmoothing,
  markerData,
}: {
  bitmap: ImageBitmap;
  canvas: RenderableCanvas;
  geometry: RenderGeometry;
  hitmapCanvas: RenderableCanvas | undefined;
  imageSmoothing: boolean;
  markerData: MarkerData | undefined;
}): RenderDimensions | undefined {
  const bitmapDimensions =
    geometry.rotation % 180 === 0
      ? { width: bitmap.width, height: bitmap.height }
      : { width: bitmap.height, height: bitmap.width };

  const canvasCtx = canvas.getContext("2d");
  if (!canvasCtx) {
    return;
  }

  canvasCtx.imageSmoothingEnabled = imageSmoothing;

  const { markers = [], cameraModel } = markerData ?? {};

  const viewportW = canvas.width;
  const viewportH = canvas.height;

  const imageViewportScale = calculateZoomScale(bitmapDimensions, canvas, geometry.zoomMode);

  const ctx = new HitmapRenderContext(canvasCtx, hitmapCanvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  // translate x/y from the center of the canvas
  ctx.translate(viewportW / 2, viewportH / 2);
  ctx.translate(geometry.panZoom.x, geometry.panZoom.y);

  ctx.scale(geometry.panZoom.scale, geometry.panZoom.scale);
  ctx.scale(imageViewportScale, imageViewportScale);

  if (geometry.flipHorizontal) {
    ctx.scale(-1, 1);
  }

  if (geometry.flipVertical) {
    ctx.scale(1, -1);
  }

  ctx.rotate(geometry.rotation);

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
  const transform = ctx.getTransform();

  try {
    paintMarkers(
      ctx,
      markers as MessageEvent<ImageMarker | ImageMarkerArray>[],
      cameraModel,
      geometry.panZoom,
    );
  } catch (err) {
    console.warn("error painting markers:", err);
  } finally {
    ctx.restore();
  }

  return { ...bitmapDimensions, transform };
}

function paintMarkers(
  ctx: HitmapRenderContext,
  messages: MessageEvent<ImageMarker | ImageMarkerArray>[],
  cameraModel: PinholeCameraModel | undefined,
  panZoom: PanZoom,
) {
  for (const { message } of messages) {
    ctx.save();
    try {
      if ("markers" in message && Array.isArray(message.markers)) {
        for (const marker of message.markers) {
          paintMarker(ctx, marker, cameraModel, panZoom);
        }
      } else {
        paintMarker(ctx, message as ImageMarker, cameraModel, panZoom);
      }
    } catch (e) {
      console.error("Unable to paint marker to ImageView", e, message);
    } finally {
      ctx.restore();
    }
  }
}

function paintMarker(
  ctx: HitmapRenderContext,
  marker: ImageMarker,
  cameraModel: PinholeCameraModel | undefined,
  panZoom: PanZoom,
) {
  ctx.startMarker();

  switch (marker.type) {
    case ImageMarkerType.CIRCLE: {
      paintCircle(
        ctx,
        marker.position,
        marker.scale,
        1.0,
        marker.outline_color,
        marker.filled ? marker.fill_color : undefined,
        cameraModel,
      );
      break;
    }

    case ImageMarkerType.LINE_LIST: {
      if (marker.points.length % 2 !== 0) {
        sendNotification(
          `ImageMarker LINE_LIST has an odd number of points`,
          `LINE_LIST marker "${marker.ns}$${marker.ns ? ":" : ""}${marker.id}" has ${
            marker.points.length
          } point${marker.points.length !== 1 ? "s" : ""}, expected an even number`,
          "user",
          "error",
        );
        break;
      }

      const hasExactColors = marker.outline_colors.length === marker.points.length / 2;

      for (let i = 0; i < marker.points.length; i += 2) {
        // Support the case where outline_colors is half the length of points,
        // one color per line, and where outline_colors matches the length of
        // points (although we only use the first color in this case). Fall back
        // to marker.outline_color as needed
        const outlineColor = hasExactColors
          ? marker.outline_colors[i / 2]!
          : marker.outline_colors.length > i
          ? marker.outline_colors[i]!
          : marker.outline_color;
        paintLine(
          ctx,
          marker.points[i]!,
          marker.points[i + 1]!,
          marker.scale,
          outlineColor,
          cameraModel,
        );
      }

      break;
    }

    case ImageMarkerType.LINE_STRIP:
    case ImageMarkerType.POLYGON: {
      if (marker.points.length === 0) {
        break;
      }
      ctx.beginPath();
      const { x, y } = maybeUnrectifyPoint(cameraModel, marker.points[0]!);
      ctx.moveTo(x, y);
      for (let i = 1; i < marker.points.length; i++) {
        const maybeUnrectifiedPoint = maybeUnrectifyPoint(cameraModel, marker.points[i]!);
        ctx.lineTo(maybeUnrectifiedPoint.x, maybeUnrectifiedPoint.y);
      }
      if (marker.type === ImageMarkerType.POLYGON) {
        ctx.closePath();
        if (marker.filled && marker.fill_color.a > 0) {
          ctx.fillStyle = toRGBA(marker.fill_color);
          ctx.fill();
        }
      }
      if (marker.outline_color.a > 0 && marker.scale > 0) {
        ctx.strokeStyle = toRGBA(marker.outline_color);
        ctx.lineWidth = marker.scale;
        ctx.stroke();
      }
      break;
    }

    case ImageMarkerType.POINTS: {
      for (let i = 0; i < marker.points.length; i++) {
        const point = marker.points[i]!;
        // This is not a typo. ImageMarker has an array for outline_colors but
        // not fill_colors, even though points are filled and not outlined. We
        // only fall back to fill_color if both outline_colors[i] and
        // outline_color are fully transparent
        const fillColor =
          marker.outline_colors.length > i
            ? marker.outline_colors[i]!
            : marker.outline_color.a > 0
            ? marker.outline_color
            : marker.fill_color;

        // For points small enough to be visually indistinct at our current zoom level
        // we do a fast render.
        const size = marker.scale * panZoom.scale;
        if (size <= FAST_POINT_SIZE_THRESHOlD) {
          paintFastPoint(ctx, point, marker.scale, marker.scale, undefined, fillColor, cameraModel);
        } else {
          paintCircle(ctx, point, marker.scale, marker.scale, undefined, fillColor, cameraModel);
        }
      }
      break;
    }

    case ImageMarkerType.TEXT: {
      // TEXT (our own extension on visualization_msgs/Marker)
      const { x, y } = maybeUnrectifyPoint(cameraModel, marker.position);
      const text = marker.text?.data ?? "";
      if (!text) {
        break;
      }

      const fontSize = marker.scale * 12;
      const padding = 4 * marker.scale;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textBaseline = "bottom";
      if (marker.filled) {
        const metrics = ctx.measureText(text);
        const height =
          "fontBoundingBoxAscent" in metrics
            ? metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
            : fontSize * 1.2;
        ctx.fillStyle = toRGBA(marker.fill_color);
        ctx.fillRect(x, y - height, Math.ceil(metrics.width + 2 * padding), Math.ceil(height));
      }
      ctx.fillStyle = toRGBA(marker.outline_color);
      ctx.fillText(text, x + padding, y);
      break;
    }

    default: {
      sendNotification(
        `Unrecognized ImageMarker type ${marker.type}`,
        `Marker "${marker.ns}$${marker.ns ? ":" : ""}${marker.id}" has an unrecognized type ${
          marker.type
        }`,
        "user",
        "error",
      );
    }
  }
}

function paintLine(
  ctx: HitmapRenderContext,
  pointA: Point2D,
  pointB: Point2D,
  thickness: number,
  outlineColor: Color,
  cameraModel: PinholeCameraModel | undefined,
) {
  if (thickness <= 0 || outlineColor.a <= 0) {
    return;
  }

  const { x: x1, y: y1 } = maybeUnrectifyPoint(cameraModel, pointA);
  const { x: x2, y: y2 } = maybeUnrectifyPoint(cameraModel, pointB);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  ctx.lineWidth = thickness;
  ctx.strokeStyle = toRGBA(outlineColor);
  ctx.stroke();
}

function paintCircle(
  ctx: HitmapRenderContext,
  point: Point2D,
  radius: number,
  thickness: number,
  outlineColor: Color | undefined,
  fillColor: Color | undefined,
  cameraModel: PinholeCameraModel | undefined,
) {
  // perf-sensitive: function params instead of options object to avoid allocations
  const hasFill = fillColor != undefined && fillColor.a > 0;
  const hasStroke = outlineColor != undefined && outlineColor.a > 0 && thickness > 0;

  if (radius <= 0 || (!hasFill && !hasStroke)) {
    return;
  }

  const { x, y } = maybeUnrectifyPoint(cameraModel, point);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);

  if (hasFill) {
    ctx.fillStyle = toRGBA(fillColor);
    ctx.fill();
  }

  if (hasStroke) {
    ctx.lineWidth = thickness;
    ctx.strokeStyle = toRGBA(outlineColor);
    ctx.stroke();
  }
}

/**
 * Renders small points as rectangles instead of circles for better performance.
 */
function paintFastPoint(
  ctx: HitmapRenderContext,
  point: Point2D,
  radius: number,
  thickness: number,
  outlineColor: Color | undefined,
  fillColor: Color | undefined,
  cameraModel: PinholeCameraModel | undefined,
) {
  // perf-sensitive: function params instead of options object to avoid allocations
  const hasFill = fillColor != undefined && fillColor.a > 0;
  const hasStroke = outlineColor != undefined && outlineColor.a > 0 && thickness > 0;

  if (radius <= 0 || (!hasFill && !hasStroke)) {
    return;
  }

  const { x, y } = maybeUnrectifyPoint(cameraModel, point);
  const size = Math.round(radius * 2);
  const rx = Math.round(x - size / 2);
  const ry = Math.round(y - size / 2);

  if (hasFill) {
    ctx.fillStyle = toRGBA(fillColor);
    ctx.fillRect(rx, ry, size, size);
  }

  if (hasStroke) {
    ctx.lineWidth = thickness;
    ctx.strokeStyle = toRGBA(outlineColor);
    ctx.strokeRect(rx, ry, size, size);
  }
}
