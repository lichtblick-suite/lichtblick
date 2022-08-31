// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const FRAME_TRANSFORM_DATATYPES = new Set<string>();
addFoxgloveSchema(FRAME_TRANSFORM_DATATYPES, "foxglove.FrameTransform");

export const POINTCLOUD_DATATYPES = new Set<string>();
addFoxgloveSchema(POINTCLOUD_DATATYPES, "foxglove.PointCloud");

export const SCENE_UPDATE_DATATYPES = new Set<string>();
addFoxgloveSchema(SCENE_UPDATE_DATATYPES, "foxglove.SceneUpdate");

// Expand a single Foxglove dataType into variations for ROS1 and ROS2 then add
// them to the given output set
function addFoxgloveSchema(output: Set<string>, dataType: string): Set<string> {
  // Add the Foxglove variation: foxglove.PointCloud
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

  return output;
}
