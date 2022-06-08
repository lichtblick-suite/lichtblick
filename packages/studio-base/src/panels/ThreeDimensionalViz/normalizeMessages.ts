// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual } from "lodash";

import {
  NormalizedPose,
  NormalizedPoseArray,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { FoxgloveMessages, NumericType } from "@foxglove/studio-base/types/FoxgloveMessages";
import {
  GeometryMsgs$PoseArray,
  LaserScan,
  NavMsgs$OccupancyGrid,
  PointCloud2,
  PoseStamped,
} from "@foxglove/studio-base/types/Messages";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

export function normalizePose(
  msg: PoseStamped | FoxgloveMessages["foxglove.PoseInFrame"],
  datatype: string,
): NormalizedPose {
  if (
    datatype === "foxglove.PoseInFrame" ||
    datatype === "foxglove_msgs/PoseInFrame" ||
    datatype === "foxglove_msgs/msg/PoseInFrame"
  ) {
    return {
      header: {
        stamp: (msg as FoxgloveMessages["foxglove.PoseInFrame"]).timestamp,
        frame_id: (msg as FoxgloveMessages["foxglove.PoseInFrame"]).frame_id,
      },
      pose: (msg as FoxgloveMessages["foxglove.PoseInFrame"]).pose,
    };
  }
  return msg as PoseStamped;
}

export function normalizePoseArray(
  msg: GeometryMsgs$PoseArray | FoxgloveMessages["foxglove.PosesInFrame"],
  datatype: string,
): NormalizedPoseArray {
  if (
    datatype === "foxglove.PosesInFrame" ||
    datatype === "foxglove_msgs/PosesInFrame" ||
    datatype === "foxglove_msgs/msg/PosesInFrame"
  ) {
    return {
      header: {
        stamp: (msg as FoxgloveMessages["foxglove.PosesInFrame"]).timestamp,
        frame_id: (msg as FoxgloveMessages["foxglove.PosesInFrame"]).frame_id,
      },
      poses: (msg as FoxgloveMessages["foxglove.PosesInFrame"]).poses,
    };
  }
  return msg as GeometryMsgs$PoseArray;
}

export function foxgloveGridToOccupancyGrid(
  msg: FoxgloveMessages["foxglove.Grid"],
): NavMsgs$OccupancyGrid {
  if (msg.cell_size.x !== msg.cell_size.y) {
    throw new Error(
      `Non-square grids are not currently supported (x=${msg.cell_size.x}, y=${msg.cell_size.y})`,
    );
  }
  if (msg.data.byteLength % msg.row_stride !== 0) {
    throw new Error(
      `Data length (${msg.data.byteLength}) should be a multiple of row_stride (${msg.row_stride})`,
    );
  }
  if (msg.fields.length !== 1 || msg.fields[0]!.type !== NumericType.INT8) {
    throw new Error("Only grids with exactly one int8 field are currently supported");
  }
  const rowCount = msg.data.byteLength / msg.row_stride;
  if (msg.column_count === 0 || rowCount === 0) {
    throw new Error("Empty grids are not currently supported");
  }
  const data = new Int8Array(rowCount * msg.column_count);
  const view = new DataView(msg.data.buffer, msg.data.byteOffset, msg.data.byteLength);
  let i = 0;
  for (let row = 0; row < rowCount; row++) {
    let offset = row * msg.row_stride + msg.fields[0]!.offset;
    for (let col = 0; col < msg.column_count; col++) {
      data[i++] = view.getInt8(offset);
      offset += msg.cell_stride;
    }
  }
  return {
    header: { seq: 0, frame_id: msg.frame_id, stamp: msg.timestamp },
    info: {
      map_load_time: { sec: 0, nsec: 0 },
      resolution: msg.cell_size.x,
      origin: msg.pose,
      width: msg.column_count,
      height: rowCount,
    },
    data,
  };
}

function numericTypeToPointFieldType(type: NumericType) {
  switch (type) {
    case NumericType.UINT8:
      return 2;
    case NumericType.INT8:
      return 1;
    case NumericType.UINT16:
      return 4;
    case NumericType.INT16:
      return 3;
    case NumericType.UINT32:
      return 6;
    case NumericType.INT32:
      return 5;
    case NumericType.FLOAT32:
      return 7;
    case NumericType.FLOAT64:
      return 8;
  }
}

export function foxglovePointCloudToPointCloud2(
  msg: FoxgloveMessages["foxglove.PointCloud"],
): PointCloud2 {
  if (!isEqual(msg.pose, emptyPose())) {
    throw new Error("Non-identity pose is not yet supported");
  }
  if (msg.data.byteLength % msg.point_stride !== 0) {
    throw new Error(
      `Data length (${msg.data.byteLength}) should be a multiple of point_stride (${msg.point_stride})`,
    );
  }
  return {
    type: 102,
    header: { seq: 0, frame_id: msg.frame_id, stamp: msg.timestamp },
    height: 1,
    width: msg.data.byteLength / msg.point_stride,
    fields: msg.fields.map(({ name, offset, type }) => ({
      name,
      offset,
      datatype: numericTypeToPointFieldType(type),
      count: 1,
    })),
    is_bigendian: false,
    is_dense: false,
    point_step: msg.point_stride,
    row_step: msg.data.byteLength,
    data: msg.data,
  };
}

export function foxgloveLaserScanToLaserScan(
  msg: FoxgloveMessages["foxglove.LaserScan"],
): LaserScan {
  if (!isEqual(msg.pose, emptyPose())) {
    throw new Error("Non-identity pose is not yet supported");
  }
  if (msg.intensities.length !== 0 && msg.ranges.length !== msg.intensities.length) {
    throw new Error("ranges and intensities should have the same length");
  }
  return {
    header: { seq: 0, frame_id: msg.frame_id, stamp: msg.timestamp },
    angle_min: msg.start_angle,
    angle_max: msg.end_angle,
    angle_increment: (msg.end_angle - msg.start_angle) / (msg.ranges.length - 1),
    time_increment: 0,
    scan_time: 0,
    range_min: -Infinity,
    range_max: Infinity,
    ranges: msg.ranges,
    intensities: msg.intensities,
  };
}
