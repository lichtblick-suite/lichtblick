// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Duration, Time } from "@foxglove/rostime";
import { MutablePose, Pose } from "@foxglove/studio-base/types/Messages";

/**
 * IImmutableCoordinateFrame allows for read only access to lookup frames
 * or perform interpolation between frames.
 */
export interface IImmutableCoordinateFrame {
  readonly id: string;

  parent(): IImmutableCoordinateFrame | undefined;
  root(): IImmutableCoordinateFrame;

  applyLocal(
    out: MutablePose,
    input: Pose,
    srcFrame: IImmutableCoordinateFrame,
    time: Time,
    maxDelta?: Duration,
  ): MutablePose | undefined;

  apply(
    out: MutablePose,
    input: Pose,
    rootFrame: IImmutableCoordinateFrame,
    srcFrame: IImmutableCoordinateFrame,
    dstTime: Time,
    srcTime: Time,
    maxDelta?: Duration,
  ): MutablePose | undefined;
}
