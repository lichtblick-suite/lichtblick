// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { RosMsgDefinition } from "@foxglove/rosmsg";
import { ros1, ros2galactic } from "@foxglove/rosmsg-msgs-common";
import { fromDate } from "@foxglove/rostime";
import { Point, makeCovarianceArray } from "@foxglove/studio-base/util/geometry";

import { Pose } from "./transforms/geometry";

export const PublishRos1Datatypes = new Map<string, RosMsgDefinition>(
  (
    [
      "geometry_msgs/Point",
      "geometry_msgs/PointStamped",
      "geometry_msgs/Pose",
      "geometry_msgs/PoseStamped",
      "geometry_msgs/PoseWithCovariance",
      "geometry_msgs/PoseWithCovarianceStamped",
      "geometry_msgs/Quaternion",
      "std_msgs/Header",
    ] as Array<keyof typeof ros1>
  ).map((type) => [type, ros1[type]]),
);

export const PublishRos2Datatypes = new Map<string, RosMsgDefinition>(
  (
    [
      "geometry_msgs/Point",
      "geometry_msgs/PointStamped",
      "geometry_msgs/Pose",
      "geometry_msgs/PoseStamped",
      "geometry_msgs/PoseWithCovariance",
      "geometry_msgs/PoseWithCovarianceStamped",
      "geometry_msgs/Quaternion",
      "std_msgs/Header",
    ] as Array<keyof typeof ros2galactic>
  ).map((type) => [type, ros2galactic[type]]),
);

export function makePointMessage(point: Point, frameId: string): unknown {
  const time = fromDate(new Date());
  return {
    // seq is omitted since it is not present in ros2
    header: { stamp: time, frame_id: frameId },
    point: { x: point.x, y: point.y, z: 0 },
  };
}

export function makePoseMessage(pose: Pose, frameId: string): unknown {
  const time = fromDate(new Date());
  return {
    // seq is omitted since it is not present in ros2
    header: { stamp: time, frame_id: frameId },
    pose,
  };
}

export function makePoseEstimateMessage(
  pose: Pose,
  frameId: string,
  xDev: number,
  yDev: number,
  thetaDev: number,
): unknown {
  const time = fromDate(new Date());
  return {
    // seq is omitted since it is not present in ros2
    header: { stamp: time, frame_id: frameId },
    pose: {
      covariance: makeCovarianceArray(xDev, yDev, thetaDev),
      pose,
    },
  };
}
