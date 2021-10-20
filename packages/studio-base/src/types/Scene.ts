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
import {
  Pose,
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
  LaserScan,
  InstancedLineListMarker,
  ColorMarker,
  PoseStamped,
  MeshMarker,
} from "@foxglove/studio-base/types/Messages";
import Bounds from "@foxglove/studio-base/util/Bounds";

export type Scene = {
  flattenedZHeightPose?: Pose;
  bounds: Bounds;
};

export interface MarkerCollector {
  arrow(arg0: ArrowMarker): void;
  color(arg0: ColorMarker): void;
  cube(arg0: CubeMarker): void;
  cubeList(arg0: CubeListMarker): void;
  sphere(arg0: SphereMarker): void;
  sphereList(arg0: SphereListMarker): void;
  cylinder(arg0: CylinderMarker): void;
  poseMarker(arg0: PoseStamped): void;
  lineStrip(arg0: LineStripMarker): void;
  lineList(arg0: LineListMarker): void;
  points(arg0: PointsMarker): void;
  text(arg0: TextMarker): void;
  mesh(arg0: MeshMarker): void;
  triangleList(arg0: TriangleListMarker): void;
  grid(arg0: OccupancyGridMessage): void;
  pointcloud(arg0: PointCloud): void;
  laserScan(arg0: LaserScan): void;
  linedConvexHull(arg0: LineListMarker | LineStripMarker): void;
  instancedLineList(arg0: InstancedLineListMarker): void;
}

export interface MarkerProvider {
  renderMarkers(add: MarkerCollector): void;
}
