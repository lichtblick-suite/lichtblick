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

import { ReactElement } from "react";

import { Arrows, Spheres } from "@foxglove/regl-worldview";
import {
  PublishClickState,
  PublishClickType,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/PublishClickTool";

const Colors: Record<PublishClickType, { r: number; g: number; b: number; a: number }> = {
  pose_estimate: { r: 0, g: 1, b: 1, a: 1 },
  goal: { r: 1, g: 0, b: 1, a: 1 },
  point: { r: 1, g: 1, b: 0, a: 1 },
} as const;

export function PublishMarker({ publish }: { publish: PublishClickState }): ReactElement {
  const arrows = [];
  const spheres = [];

  if (publish.type === "point") {
    if (publish.start) {
      spheres.push({
        action: 0,
        color: Colors[publish.type],
        id: "_publish-click-sphere",
        pose: {
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          position: publish.start,
        },
        scale: { x: 0.3, y: 0.3, z: 0.1 },
        type: 2,
      });
    }
  } else if (publish.start && publish.end) {
    arrows.push({
      action: 0,
      color: Colors[publish.type],
      id: "_publish-click-arrow",
      points: [publish.start, publish.end],
      pose: {
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        position: { x: 0, y: 0, z: 0 },
      },
      scale: { x: 0.125, y: 0.25, z: 0.25 },
      type: 0,
    });
  }

  return (
    <>
      {spheres.length > 0 && <Spheres>{spheres}</Spheres>}
      {arrows.length > 0 && <Arrows>{arrows}</Arrows>}
    </>
  );
}
