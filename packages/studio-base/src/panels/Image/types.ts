// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { AVLTree } from "@foxglove/avl";
import type { PinholeCameraModel } from "@foxglove/den/image";
import type { Time } from "@foxglove/rostime";
import { Immutable } from "@foxglove/studio";
import type { RenderState } from "@foxglove/studio";
import type { CameraInfo, Color, ImageMarker, Point2D } from "@foxglove/studio-base/types/Messages";

export type DefaultConfig = {
  cameraTopic: string;
  enabledMarkerTopics: string[];
  synchronize: boolean;
};

export type Config = DefaultConfig & {
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  maxValue?: number;
  minValue?: number;
  mode?: ZoomMode;
  pan?: { x: number; y: number };
  rotation?: number;
  smooth?: boolean;
  transformMarkers: boolean;
  zoom?: number;
  zoomPercentage?: number;
  closedDeprecationBanner?: boolean;
};

export type UseImagePanelMessagesParams = {
  imageTopic: string;
  cameraInfoTopic: string | undefined;
  annotationTopics: string[];
  synchronize: boolean;
};

export type SynchronizationItem = {
  image?: NormalizedImageMessage;
  annotationsByTopic: Map<string, Annotation[]>;
};

export type ImagePanelState = UseImagePanelMessagesParams & {
  image?: NormalizedImageMessage;
  cameraInfo?: CameraInfo;
  annotationsByTopic: ReadonlyMap<string, Annotation[]>;
  tree: AVLTree<Time, SynchronizationItem>;

  actions: {
    setCurrentFrame(currentFrame: NonNullable<Immutable<RenderState["currentFrame"]>>): void;
    clear(): void;
    setParams(newParams: UseImagePanelMessagesParams): void;
  };
};

export type PanZoom = { x: number; y: number; scale: number };

export type ZoomMode = "fit" | "fill" | "other";

export type Dimensions = { width: number; height: number };

export type RawMarkerData = {
  markers: readonly Annotation[];
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
  markers: readonly Annotation[];
  originalWidth?: number; // undefined means no scaling is needed (use the image's size)
  originalHeight?: number; // undefined means no scaling is needed (use the image's size)
  cameraModel?: PinholeCameraModel; // undefined means no transformation is needed
};

export type PathKey = string | number;

export type CircleAnnotation = {
  type: "circle";
  stamp: Time;
  fillColor?: Color;
  outlineColor?: Color;
  radius: number;
  thickness: number;
  position: Point2D;
  messagePath: PathKey[];
};

export type PointsAnnotation = {
  type: "points";
  stamp: Time;
  style: "points" | "polygon" | "line_strip" | "line_list";
  points: readonly Point2D[];
  outlineColors: readonly Color[];
  outlineColor?: Color;
  thickness: number;
  fillColor?: Color;
  messagePath: PathKey[];
};

export type TextAnnotation = {
  type: "text";
  stamp: Time;
  position: Point2D;
  text: string;
  textColor: Color;
  backgroundColor?: Color;
  fontSize: number;
  padding: number;
  messagePath: PathKey[];
};

export type Annotation = CircleAnnotation | PointsAnnotation | TextAnnotation;

export type RawImageMessage = {
  type: "raw";
  stamp: { sec: number; nsec: number };
  width: number;
  height: number;
  is_bigendian: boolean;
  encoding: string;
  step: number;
  data: Uint8Array;
};

export type CompressedImageMessage = {
  type: "compressed";
  stamp: { sec: number; nsec: number };
  format: string;
  data: Uint8Array;
};

export type NormalizedImageMessage = RawImageMessage | CompressedImageMessage;
