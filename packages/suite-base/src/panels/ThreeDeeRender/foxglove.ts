// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const FRAME_TRANSFORM_DATATYPES = new Set<string>();
addFoxgloveSchema(FRAME_TRANSFORM_DATATYPES, "foxglove.FrameTransform");

export const FRAME_TRANSFORMS_DATATYPES = new Set<string>();
addFoxgloveSchema(FRAME_TRANSFORMS_DATATYPES, "foxglove.FrameTransforms");

export const POINTCLOUD_DATATYPES = new Set<string>();
addFoxgloveSchema(POINTCLOUD_DATATYPES, "foxglove.PointCloud");

export const LASERSCAN_DATATYPES = new Set<string>();
addFoxgloveSchema(LASERSCAN_DATATYPES, "foxglove.LaserScan");

export const RAW_IMAGE_DATATYPES = new Set<string>();
addFoxgloveSchema(RAW_IMAGE_DATATYPES, "foxglove.RawImage");

export const COMPRESSED_IMAGE_DATATYPES = new Set<string>();
addFoxgloveSchema(COMPRESSED_IMAGE_DATATYPES, "foxglove.CompressedImage");

export const CAMERA_CALIBRATION_DATATYPES = new Set<string>();
addFoxgloveSchema(CAMERA_CALIBRATION_DATATYPES, "foxglove.CameraCalibration");

export const SCENE_UPDATE_DATATYPES = new Set<string>();
addFoxgloveSchema(SCENE_UPDATE_DATATYPES, "foxglove.SceneUpdate");

export const POSE_IN_FRAME_DATATYPES = new Set<string>();
addFoxgloveSchema(POSE_IN_FRAME_DATATYPES, "foxglove.PoseInFrame");

export const POSES_IN_FRAME_DATATYPES = new Set<string>();
addFoxgloveSchema(POSES_IN_FRAME_DATATYPES, "foxglove.PosesInFrame");

export const GRID_DATATYPES = new Set<string>();
addFoxgloveSchema(GRID_DATATYPES, "foxglove.Grid");

export const IMAGE_ANNOTATIONS_DATATYPES = new Set<string>();
addFoxgloveSchema(IMAGE_ANNOTATIONS_DATATYPES, "foxglove.ImageAnnotations");

// Expand a single Foxglove schema name into variations for ROS1, ROS2, and IDL and add
// them to the output set.
export function addFoxgloveSchema(output: Set<string>, dataType: string): Set<string> {
  // Add the Foxglove json, protobuf, and flatbuffer variation: foxglove.PointCloud
  output.add(dataType);

  const parts = dataType.split(".");
  if (parts.length < 2) {
    throw new Error(`Invalid Foxglove schema: ${dataType}`);
  }
  const leaf = parts.slice(1).join("/");

  // Add the ROS1 variation: foxglove_msgs/PointCloud
  output.add(`foxglove_msgs/${leaf}`);

  // Add the ROS2 variation: foxglove_msgs/msg/PointCloud
  output.add(`foxglove_msgs/msg/${leaf}`);

  // Add the IDL variation: foxglove::PointCloud
  output.add(`foxglove::${leaf}`);

  return output;
}
