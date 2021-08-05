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

import tinyColor from "tinycolor2";

import { ColorOverride } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/Layout";
import { hexToColorObj } from "@foxglove/studio-base/util/colorUtils";
import { lineColors } from "@foxglove/studio-base/util/plotColors";

export function getDefaultColorOverrideBySourceIdx(defaultColorIndex: number): ColorOverride[] {
  return [
    {
      active: false,
      color: hexToColorObj(lineColors[defaultColorIndex % lineColors.length]!, 1),
    },
    {
      active: false,
      color: hexToColorObj(
        tinyColor(lineColors[defaultColorIndex % lineColors.length])
          .spin(90) // We change the default color a bit for the second bag. Spin(90) seemed to produce nice results
          .toHexString(),
        1, // Alpha: 1
      ),
    },
  ];
}
