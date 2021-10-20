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

// All message types supported by Rviz
// http://wiki.ros.org/rviz/DisplayTypes

import { Time } from "@foxglove/rostime";

export type Namespace = Readonly<{
  topic: string;
  name: string;
}>;

export type MutablePoint = {
  x: number;
  y: number;
  z: number;
};
export type Point = Readonly<MutablePoint>;
type Points = readonly Point[];

export type Header = Readonly<{
  frame_id: string;
  stamp: Time;
  seq: number;
}>;

export type StampedMessage = Readonly<{
  header: Header;
}>;

export type GeometryMsgs$PolygonStamped = Readonly<{
  header: Header;
  polygon: Polygon;
}>;

type Duration = Time;

type MutableOrientation = {
  x: number;
  y: number;
  z: number;
  w: number;
};
export type Orientation = Readonly<MutableOrientation>;

export type Scale = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type Color = Readonly<{
  r: number;
  g: number;
  b: number;
  a: number;
}>;

export type Pose = Readonly<{
  position: Point;
  orientation: Orientation;
}>;

// NOTE: Deep mutability.
export type MutablePose = {
  position: MutablePoint;
  orientation: MutableOrientation;
};

export type Polygon = Readonly<{
  points: Points;
}>;

export type LaserScan = Readonly<{
  header: Header;
  angle_increment: number;
  angle_max: number;
  angle_min: number;
  intensities: readonly number[];
  range_max: number;
  range_min: number;
  ranges: readonly number[];
  scan_time?: number;
  time_increment?: number;
}>;

export type PoseStamped = Readonly<
  StampedMessage & {
    pose: Pose;
  }
>;

type Colors = readonly Color[];

// Markers
export type BaseMarker = Readonly<
  StampedMessage & {
    ns: string;
    id: string | number; // TODO: Actually just a number
    action: 0 | 1 | 2 | 3;
    pose: Pose;
    scale: Scale;
    color?: Color;
    colors?: Colors;
    lifetime?: Time;
    frame_locked?: boolean; // TODO: required
    text?: string;
    mesh_resource?: string; // TODO: required
    mesh_use_embedded_materials?: boolean;
    primitive?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }
>;

type MultiPointMarker = Readonly<{
  points: Points;
  colors?: Colors;
}>;

type ArrowSize = Readonly<{
  shaftWidth: number;
  headLength: number;
  headWidth: number;
}>;

// TODO: Is this correct?
export type ArrowMarker = Readonly<
  BaseMarker & {
    type: 0;
    points?: Points;
    // used for hard-coded arrows with geometry_msgs/PoseStamped
    // not part of the original ros message
    size?: ArrowSize;
  }
>;

export type CubeMarker = Readonly<
  BaseMarker & {
    type: 1;
  }
>;

export type SphereMarker = Readonly<
  BaseMarker & {
    type: 2;
  }
>;

export type CylinderMarker = Readonly<
  BaseMarker & {
    type: 3;
  }
>;

export type LineStripMarker = Readonly<
  BaseMarker &
    MultiPointMarker & {
      closed?: boolean;
      type: 4;
    }
>;

export type LineListMarker = Readonly<
  BaseMarker &
    MultiPointMarker & {
      type: 5;
    }
>;

export type CubeListMarker = Readonly<
  BaseMarker &
    MultiPointMarker & {
      type: 6;
    }
>;

export type SphereListMarker = Readonly<
  BaseMarker &
    MultiPointMarker & {
      type: 7;
    }
>;

export type PointsMarker = Readonly<
  BaseMarker &
    MultiPointMarker & {
      type: 8;
    }
>;

export type TextMarker = Readonly<
  BaseMarker & {
    type: 9;
    text: string;
  }
>;

export type MeshMarker = Readonly<
  BaseMarker & {
    type: 10;
    mesh_resource: string;
    mesh_use_embedded_materials: boolean;
  }
>;

type NavMsgs$MapMetaData = Readonly<{
  map_load_time: Time;
  resolution: number;
  width: number;
  height: number;
  origin: Pose;
}>;

export type NavMsgs$OccupancyGrid = Readonly<{
  header: Header;
  info: NavMsgs$MapMetaData;
  data: readonly number[];
}>;

export type NavMsgs$Path = Readonly<{
  header: Header;
  poses: PoseStamped[];
}>;

export type OccupancyGridMessage = Readonly<{
  header: Header;
  name: string;
  type: 101;
  map: "map" | "costmap";
  alpha: number;
  info: NavMsgs$MapMetaData;
  data: readonly number[];
}>;

export type TriangleListMarker = Readonly<
  BaseMarker &
    MultiPointMarker & {
      type: 11;
    }
>;

export type InstancedLineListMarker = Readonly<
  BaseMarker &
    MultiPointMarker & {
      type: 108;
      metadataByIndex?: readonly Readonly<unknown[]>[];
      scaleInvariant?: boolean;
    }
>;

export type ColorMarker = Readonly<
  BaseMarker & {
    type: 110;
  }
>;

export type Marker =
  | ArrowMarker
  | CubeMarker
  | CubeListMarker
  | SphereMarker
  | SphereListMarker
  | CylinderMarker
  | LineStripMarker
  | LineListMarker
  | CubeListMarker
  | PointsMarker
  | TextMarker
  | MeshMarker
  | TriangleListMarker
  | MeshMarker
  | InstancedLineListMarker
  | ColorMarker;

export type MarkerArray = Readonly<{
  markers: readonly Marker[];
}>;

type ChannelFloat = Readonly<{
  name: string;
  values: readonly number[];
}>;

type PointCloud1 = Readonly<
  StampedMessage & {
    points: Points;
    channels: readonly ChannelFloat[];
    type: "PointCloud1";
  }
>;

export type PointField = Readonly<{
  name: string;
  offset: number;
  datatype: number;
  count: number;
}>;

export type PointCloud2 = Readonly<
  StampedMessage & {
    fields: readonly PointField[];
    height: number;
    width: number;
    is_bigendian: boolean;
    point_step: number; // Length of point in bytes
    row_step: number; // Length of row in bytes
    // TODO(steel): Figure out how to make data read-only in flow.
    data: Uint8Array;
    is_dense: number;
    // this is appended by scene builder
    type: 102;
    // this is appended by scene builder
    pose?: Pose;
  }
>;

export type Image = Readonly<
  StampedMessage & {
    height: number;
    width: number;
    encoding: string;
    is_bigendian: boolean;
    step: number;
    data: Uint8Array;
  }
>;

export type CompressedImage = Readonly<
  StampedMessage & {
    format: string;
    data: Uint8Array;
  }
>;

export type VelodynePacket = Readonly<{
  stamp: Time;
  data: Uint8Array; // 1206 bytes
}>;

export type VelodyneScan = Readonly<
  StampedMessage & {
    packets: VelodynePacket[];
  }
>;

export type VelodyneScanDecoded = Readonly<
  PointCloud2 & {
    packets: VelodynePacket[];
  }
>;

export type PointCloud = PointCloud1 | PointCloud2 | VelodyneScanDecoded;

type Transform = Readonly<{
  rotation: Orientation;
  translation: Point;
}>;

export type TF = Readonly<
  StampedMessage & {
    transform: Transform;
    child_frame_id: string;
  }
>;

export type ImageMarker = Readonly<{
  header: Header;
  ns: string;
  id: number;
  type: 0 | 1 | 2 | 3 | 4 | 5;
  action: 0 | 1;
  position: Point;
  scale: number;
  outline_color: Color;
  filled: boolean;
  fill_color: Color;
  lifetime: Duration;
  points: Points;
  outline_colors: Colors;
  text: { data: string };
  thickness: number;
}>;

export type ImageMarkerArray = Readonly<{
  markers: ImageMarker[];
}>;

type Roi = Readonly<{
  x_offset: number;
  y_offset: number;
  height: number;
  width: number;
  do_rectify: false;
}>;

type DistortionModel = "plumb_bob" | "rational_polynomial";

export type CameraInfo = Readonly<{
  width: number;
  height: number;
  binning_x: number;
  binning_y: number;
  roi: Roi;
  distortion_model: DistortionModel;
  D: readonly number[];
  K: readonly number[];
  P: readonly number[];
  R: readonly number[];
}>;

export type JointState = Readonly<{
  header: Header;
  name: string[];
  position: number[];
  velocity: number[];
  effort: number[];
}>;
