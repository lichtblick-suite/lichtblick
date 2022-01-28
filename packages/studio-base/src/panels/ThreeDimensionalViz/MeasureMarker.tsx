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

import { Lines, Spheres } from "@foxglove/regl-worldview";
import { MeasuringState } from "@foxglove/studio-base/panels/ThreeDimensionalViz/MeasuringTool";

const SphereSize: number = 0.3;
const LineSize: number = 0.1;

const DefaultSphere = {
  action: 0,
  color: { r: 1, g: 0.2, b: 0, a: 1 },
  scale: { x: SphereSize, y: SphereSize, z: 0.1 },
  type: 2,
} as const;

const DefaultPose = { orientation: { x: 0, y: 0, z: 0, w: 1 } } as const;

export default function MeasureMarker({ measure }: { measure: MeasuringState }): ReactElement {
  const spheres = [];
  const lines = [];

  if (measure.start) {
    spheres.push({
      ...DefaultSphere,
      id: "_measure_start",
      pose: { position: measure.start, ...DefaultPose },
    });
  }

  if (measure.state === "finish") {
    lines.push({
      ...DefaultSphere,
      id: "_measure_line",
      points: [measure.start, measure.end],
      pose: { ...DefaultPose, position: { x: 0, y: 0, z: 0 } },
      scale: { x: LineSize, y: 1, z: 1 },
      type: 4,
    });

    spheres.push({
      ...DefaultSphere,
      id: "_measure_end",
      pose: { position: measure.end, ...DefaultPose },
    });
  }

  return (
    <>
      {lines.length > 0 && <Lines>{lines}</Lines>}
      {spheres.length > 0 && <Spheres>{spheres}</Spheres>}
    </>
  );
}
