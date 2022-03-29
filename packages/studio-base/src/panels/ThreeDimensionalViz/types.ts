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

import { CameraState, ReglClickInfo } from "@foxglove/regl-worldview";
import { Time } from "@foxglove/rostime";
import {
  ArrowMarker,
  CubeMarker,
  SphereMarker,
  CylinderMarker,
  LineStripMarker,
  LineListMarker,
  CubeListMarker,
  SphereListMarker,
  PointsMarker,
  TextMarker,
  TriangleListMarker,
  OccupancyGridMessage,
  PointCloud,
  InstancedLineListMarker,
  ColorMarker,
  MeshMarker,
  GlLineListMarker,
  Pose,
} from "@foxglove/studio-base/types/Messages";

import { ColorOverrideByVariable, ColorOverride } from "./Layout";
import { TopicSettingsCollection } from "./SceneBuilder";
import { TopicDisplayMode } from "./TopicTree/types";
import { IImmutableCoordinateFrame, IImmutableTransformTree, Transform } from "./transforms";

/** @deprecated */
type ColorOverrideBySourceIdxByVariable = Record<string, ColorOverride[]>;

/**
 * Config items which existed in previous versions. Used to migrate to new versions
 * @deprecated */
type PreviousThreeDimensionalVizConfig = {
  colorOverrideBySourceIdxByVariable?: ColorOverrideBySourceIdxByVariable;
};

export type NormalizedPose = {
  header: { stamp: Time; frame_id: string };
  pose: Pose;
};

export type NormalizedPoseArray = {
  header: { stamp: Time; frame_id: string };
  poses: Pose[];
};

export interface MarkerCollector {
  arrow(arg0: ArrowMarker): void;
  color(arg0: ColorMarker): void;
  cube(arg0: CubeMarker): void;
  cubeList(arg0: CubeListMarker): void;
  sphere(arg0: SphereMarker): void;
  sphereList(arg0: SphereListMarker): void;
  cylinder(arg0: CylinderMarker): void;
  poseMarker(
    arg0: (NormalizedPose & { type: 103 }) | (NormalizedPoseArray & { type: 111; pose: Pose }),
  ): void;
  lineStrip(arg0: LineStripMarker): void;
  lineList(arg0: LineListMarker): void;
  points(arg0: PointsMarker): void;
  text(arg0: TextMarker): void;
  mesh(arg0: MeshMarker): void;
  triangleList(arg0: TriangleListMarker): void;
  grid(arg0: OccupancyGridMessage): void;
  pointcloud(arg0: PointCloud): void;
  linedConvexHull(arg0: LineListMarker | LineStripMarker): void;
  instancedLineList(arg0: InstancedLineListMarker): void;
  glLineList(arg0: GlLineListMarker): void;
}

export type MouseEventName = "onDoubleClick" | "onMouseMove" | "onMouseDown" | "onMouseUp";

export type ReglMouseEventHandler = (ev: React.MouseEvent, click: ReglClickInfo) => void;

export type MouseEventHandlerProps = {
  addMouseEventHandler: (eventName: MouseEventName, handler: ReglMouseEventHandler) => void;
  removeMouseEventHandler: (eventName: MouseEventName, handler: ReglMouseEventHandler) => void;
};

export type RenderMarkerArgs = {
  add: MarkerCollector;
  renderFrame: IImmutableCoordinateFrame;
  fixedFrame: IImmutableCoordinateFrame;
  transforms: IImmutableTransformTree;
  time: Time;
};

export interface MarkerProvider {
  renderMarkers(args: RenderMarkerArgs): void;
}

export type ThreeDimensionalVizConfig = {
  autoSyncCameraState?: boolean;
  autoTextBackgroundColor?: boolean;
  cameraState: Partial<CameraState>;
  checkedKeys: string[];
  clickToPublishPoseTopic: string;
  clickToPublishPointTopic: string;
  clickToPublishPoseEstimateTopic: string;
  clickToPublishPoseEstimateXDeviation: number;
  clickToPublishPoseEstimateYDeviation: number;
  clickToPublishPoseEstimateThetaDeviation: number;
  colorOverrideByVariable?: ColorOverrideByVariable;
  customBackgroundColor: string;
  diffModeEnabled: boolean;
  disableAutoOpenClickedObject?: boolean;
  enableShortDisplayNames?: boolean;
  expandedKeys: string[];
  ignoreColladaUpAxis?: boolean;
  flattenMarkers?: boolean;
  followMode?: "follow" | "follow-orientation" | "no-follow";
  followTf?: string;
  modifiedNamespaceTopics?: string[];
  pinTopics: boolean;
  settingsByKey: TopicSettingsCollection;
  showCrosshair?: boolean;
  topicDisplayMode?: TopicDisplayMode;
  useThemeBackgroundColor: boolean;
} & PreviousThreeDimensionalVizConfig;

/**
 * TransformLink describes the transform between two coordinate frames.
 */
export type TransformLink = {
  parent: string;
  child: string;
  transform: Transform;
};

export type FollowMode = "follow" | "follow-orientation" | "no-follow";
