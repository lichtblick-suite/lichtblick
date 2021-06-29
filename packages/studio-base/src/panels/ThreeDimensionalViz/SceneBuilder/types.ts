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

import { Frame } from "@foxglove/studio-base/players/types";
import { Color, Pose } from "@foxglove/studio-base/types/Messages";

export type ThreeDimensionalVizHooks = Readonly<{
  getMarkerColor: (arg0: string, arg1: Color) => Color;
  getOccupancyGridValues: (arg0: string) => [number, string]; // arg is topic, return value is [alpha, map].
  getFlattenedPose: (arg0: Frame) => Pose | undefined;
  getSyntheticArrowMarkerColor: (arg0: string) => Color; // arg is topic
}>;
