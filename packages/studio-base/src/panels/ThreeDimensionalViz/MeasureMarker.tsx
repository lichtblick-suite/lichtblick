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

import { Lines, Spheres, Point } from "@foxglove/regl-worldview";

type Props = {
  measurePoints: { start?: Point; end?: Point };
};

const sphereSize: number = 0.3;
const lineSize: number = 0.1;

const defaultSphere = Object.freeze({
  type: 2,
  action: 0,
  scale: { x: sphereSize, y: sphereSize, z: 0.1 },
  color: { r: 1, g: 0.2, b: 0, a: 1 },
});
const defaultPose = Object.freeze({ orientation: { x: 0, y: 0, z: 0, w: 1 } });

export default function MeasureMarker({ measurePoints: { start, end } }: Props): JSX.Element {
  const spheres = [];
  const lines = [];
  if (start) {
    const startPoint = { ...start };

    spheres.push({
      ...defaultSphere,
      id: "_measure_start",
      pose: { position: startPoint, ...defaultPose },
    });

    if (end) {
      const endPoint = { ...end };
      lines.push({
        ...defaultSphere,
        id: "_measure_line",
        points: [start, end],
        pose: { ...defaultPose, position: { x: 0, y: 0, z: 0 } },
        scale: { x: lineSize, y: 1, z: 1 },
        type: 4,
      });

      spheres.push({
        ...defaultSphere,
        id: "_measure_end",
        pose: { position: endPoint, ...defaultPose },
      });
    }
  }

  return (
    <>
      {lines.length > 0 && <Lines>{lines}</Lines>}
      {spheres.length > 0 && <Spheres>{spheres}</Spheres>}
    </>
  );
}
