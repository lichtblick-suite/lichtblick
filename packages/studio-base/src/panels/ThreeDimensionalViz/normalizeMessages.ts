// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  NormalizedPose,
  NormalizedPoseArray,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { FoxgloveMessages } from "@foxglove/studio-base/types/FoxgloveMessages";
import { GeometryMsgs$PoseArray, PoseStamped } from "@foxglove/studio-base/types/Messages";

export function normalizePose(
  msg: PoseStamped | FoxgloveMessages["foxglove.PoseInFrame"],
  datatype: string,
): NormalizedPose {
  if (datatype === "foxglove.PoseInFrame") {
    return {
      header: {
        stamp: (msg as FoxgloveMessages[typeof datatype]).timestamp,
        frame_id: (msg as FoxgloveMessages[typeof datatype]).frame_id,
      },
      pose: (msg as FoxgloveMessages[typeof datatype]).pose,
    };
  }
  return msg as PoseStamped;
}

export function normalizePoseArray(
  msg: GeometryMsgs$PoseArray | FoxgloveMessages["foxglove.PosesInFrame"],
  datatype: string,
): NormalizedPoseArray {
  if (datatype === "foxglove.PosesInFrame") {
    return {
      header: {
        stamp: (msg as FoxgloveMessages[typeof datatype]).timestamp,
        frame_id: (msg as FoxgloveMessages[typeof datatype]).frame_id,
      },
      poses: (msg as FoxgloveMessages[typeof datatype]).poses,
    };
  }
  return msg as GeometryMsgs$PoseArray;
}
