// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Duration, Time } from "@foxglove/rostime";
import { MutablePose, Pose } from "@foxglove/studio-base/types/Messages";

import { IImmutableCoordinateFrame } from "./IImmutableCoordinateFrame";

/**
 * IImmutableTransformTree allows for read only access to lookup frames
 * or perform interpolation between frames.
 */
export interface IImmutableTransformTree {
  hasFrame(id: string): boolean;
  frame(id: string): IImmutableCoordinateFrame | undefined;

  frames(): ReadonlyMap<string, IImmutableCoordinateFrame>;

  apply(
    output: MutablePose,
    input: Pose,
    frameId: string,
    rootFrameId: string | undefined,
    srcFrameId: string,
    dstTime: Time,
    srcTime: Time,
    maxDelta?: Duration,
  ): MutablePose | undefined;
}
