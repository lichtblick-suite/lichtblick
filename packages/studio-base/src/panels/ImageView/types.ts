// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { MessageEvent } from "@foxglove/studio";
import type { CameraInfo, ImageMarker } from "@foxglove/studio-base/types/Messages";

import type PinholeCameraModel from "./PinholeCameraModel";
import type { NormalizedImageMessage } from "./normalizeMessage";

export type PanZoom = { x: number; y: number; scale: number };

export type ZoomMode = "fit" | "fill" | "other";

export type Dimensions = { width: number; height: number };

export type RawMarkerData = {
  markers: MessageEvent<unknown>[];
  transformMarkers: boolean;
  cameraInfo?: CameraInfo;
};

export type RenderOptions = {
  imageSmoothing?: boolean;
  minValue?: number;
  maxValue?: number;

  // resize the canvas element to fit the bitmap
  // default is false
  resizeCanvas?: boolean;
};

export type RenderGeometry = {
  flipVertical: boolean;
  flipHorizontal: boolean;
  panZoom: PanZoom;
  rotation: number;
  viewport: Dimensions;
  zoomMode: ZoomMode;
};

export type RenderArgs = {
  // an undefined imageMessage clears the canvas
  imageMessage?: NormalizedImageMessage;
  geometry: RenderGeometry;
  options?: RenderOptions;
  rawMarkerData: RawMarkerData;
};

export type PixelData = {
  color: { r: number; g: number; b: number; a: number };
  position: { x: number; y: number };
  markerIndex?: number;
  marker?: ImageMarker;
};

export type RenderableCanvas = HTMLCanvasElement | OffscreenCanvas;

export type RenderDimensions = Dimensions & { transform: DOMMatrix };

export type MarkerData = {
  markers: MessageEvent<unknown>[];
  originalWidth?: number; // undefined means no scaling is needed (use the image's size)
  originalHeight?: number; // undefined means no scaling is needed (use the image's size)
  cameraModel?: PinholeCameraModel; // undefined means no transformation is needed
};
