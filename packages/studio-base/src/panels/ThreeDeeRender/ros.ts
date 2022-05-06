// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export enum MarkerType {
  ARROW = 0,
  CUBE = 1,
  SPHERE = 2,
  CYLINDER = 3,
  LINE_STRIP = 4,
  LINE_LIST = 5,
  CUBE_LIST = 6,
  SPHERE_LIST = 7,
  POINTS = 8,
  TEXT_VIEW_FACING = 9,
  MESH_RESOURCE = 10,
  TRIANGLE_LIST = 11,
}

export enum MarkerAction {
  ADD = 0,
  MODIFY = 0,
  DELETE = 2,
  DELETEALL = 3,
}

export enum PointFieldType {
  INT8 = 1,
  UINT8 = 2,
  INT16 = 3,
  UINT16 = 4,
  INT32 = 5,
  UINT32 = 6,
  FLOAT32 = 7,
  FLOAT64 = 8,
}

export type RosTime = {
  sec: number;
  nsec: number;
};

export type RosDuration = RosTime;

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type ColorRGB = {
  r: number;
  g: number;
  b: number;
};

export type ColorRGBA = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type Pose = {
  position: Vector3;
  orientation: Quaternion;
};

export type Header = {
  frame_id: string;
  stamp: RosTime;
  seq?: number;
};

export type TF = {
  header: Header;
  child_frame_id: string;
  transform: {
    rotation: Quaternion;
    translation: Vector3;
  };
};

export type Marker = {
  header: Header;
  ns: string;
  id: number;
  type: number;
  action: number;
  pose: Pose;
  scale: Vector3;
  color: ColorRGBA;
  lifetime: RosDuration;
  frame_locked: boolean;
  points: Vector3[];
  colors: ColorRGBA[];
  text: string;
  mesh_resource: string;
  mesh_use_embedded_materials: boolean;
};

export type PointField = {
  name: string;
  offset: number;
  datatype: number;
  count: number;
};

export type PointCloud2 = {
  header: Header;
  height: number;
  width: number;
  fields: PointField[];
  is_bigendian: boolean;
  point_step: number;
  row_step: number;
  data: Uint8Array;
  is_dense: boolean;
};

export type MapMetaData = {
  map_load_time: RosTime;
  resolution: number;
  width: number;
  height: number;
  origin: Pose;
};

export type OccupancyGrid = {
  header: Header;
  info: MapMetaData;
  data: Int8Array | number[];
};

export const TRANSFORM_STAMPED_DATATYPES = new Set<string>();
addRosDataType(TRANSFORM_STAMPED_DATATYPES, "geometry_msgs/TransformStamped");

export const TF_DATATYPES = new Set<string>();
addRosDataType(TF_DATATYPES, "tf/tfMessage");
addRosDataType(TF_DATATYPES, "tf2_msgs/TFMessage");

export const MARKER_DATATYPES = new Set<string>();
addRosDataType(MARKER_DATATYPES, "visualization_msgs/Marker");

export const MARKER_ARRAY_DATATYPES = new Set<string>();
addRosDataType(MARKER_ARRAY_DATATYPES, "visualization_msgs/MarkerArray");

export const OCCUPANCY_GRID_DATATYPES = new Set<string>();
addRosDataType(OCCUPANCY_GRID_DATATYPES, "nav_msgs/OccupancyGrid");

export const POINTCLOUD_DATATYPES = new Set<string>();
addRosDataType(POINTCLOUD_DATATYPES, "sensor_msgs/PointCloud2");

export function rosTimeToNanoSec(rosTime: { sec: number; nsec: number }): bigint {
  return BigInt(rosTime.sec) * BigInt(1e9) + BigInt(rosTime.nsec);
}

// Expand a single ROS1 dataType into variations for ROS2 and protobufs,
// then add them to the given output set
function addRosDataType(output: Set<string>, dataType: string): Set<string> {
  // Add the ROS1 variation: tf2_msgs/TFMessage
  output.add(dataType);

  // Add the ROS2 variation: tf2_msgs/msg/TFMessage
  const parts = dataType.split("/");
  if (parts.length > 1) {
    const base = parts[0];
    const leaf = parts.slice(1).join("/");
    output.add(`${base}/msg/${leaf}`);
  }

  // Add the protobuf variation: ros.tf2_msgs.TFMessage
  output.add("ros." + dataType.split("/").join("."));

  return output;
}
