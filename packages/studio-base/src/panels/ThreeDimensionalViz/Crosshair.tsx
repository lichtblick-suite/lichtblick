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

import { vec3, quat } from "gl-matrix";

import { cameraStateSelectors, Lines, CameraState } from "@foxglove/regl-worldview";

type Props = {
  cameraState: CameraState;
};

export default function Crosshair({ cameraState }: Props): JSX.Element {
  const { target, targetOffset, distance, thetaOffset } = cameraState;
  const targetHeading = cameraStateSelectors.targetHeading(cameraState) as number;
  // move the crosshair to the center of the camera's viewport: the target + targetOffset rotated by heading
  const crosshairPoint: vec3 = [0, 0, 0];
  vec3.add(
    crosshairPoint,
    vec3.rotateZ(crosshairPoint, targetOffset, [0, 0, 0], -targetHeading),
    target,
  );

  // orient and size the crosshair so it remains visually fixed in the center
  const length = 0.02 * distance;
  const orientation: quat = [0, 0, 0, 1];
  const theta = targetHeading + thetaOffset;

  quat.rotateZ(orientation, orientation, -theta);

  const crosshair = (z: number, extraThickness: number) => {
    const thickness = 0.004 * distance * (1 + extraThickness);
    return {
      header: {
        frame_id: "map",
        stamp: { sec: 0, nsec: 0 },
      },
      type: 5,
      action: 0,
      id: "",
      ns: "",
      pose: {
        position: { x: crosshairPoint[0], y: crosshairPoint[1], z },
        orientation: {
          x: orientation[0],
          y: orientation[1],
          z: orientation[2],
          w: orientation[3],
        },
      },
      points: [
        { x: -length * (1 + 0.1 * extraThickness), y: 0, z: 0 },
        { x: length * (1 + 0.1 * extraThickness), y: 0, z: 0 },
        { x: 0, y: -length * (1 + 0.1 * extraThickness), z: 0 },
        { x: 0, y: length * (1 + 0.1 * extraThickness), z: 0 },
      ],
      scale: { x: thickness, y: thickness, z: thickness },
    };
  };

  return (
    <Lines>
      {[
        {
          ...crosshair(1000, 0.6),
          color: { r: 0, g: 0, b: 0, a: 1 },
        },
        {
          ...crosshair(1001, 0),
          color: { r: 1, g: 1, b: 1, a: 1 },
        },
      ]}
    </Lines>
  );
}
