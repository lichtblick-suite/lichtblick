// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { storiesOf } from "@storybook/react";
import { ComponentProps } from "react";

import { Worldview, DEFAULT_CAMERA_STATE, Color } from "@foxglove/regl-worldview";

import PoseMarkers from "./PoseMarkers";

type PoseMarker = ComponentProps<typeof PoseMarkers>["markers"][0];

const MARKER_DATA = {
  header: { seq: 26967, stamp: { sec: 1516929048, nsec: 413347495 }, frame_id: "" },
  pose: {
    position: { x: -1937.7028138723192, y: 1770.5034239982174, z: 52.870026489273044 },
    orientation: { x: 0, y: 0, z: -0.9928242172830276, w: 0.11958291506876588 },
  },
  scale: { x: 1, y: 1, z: 1 },
  color: { r: 1, g: 1, b: 1, a: 0.5 },
  settings: { overrideColor: undefined },
};
const targetPosition = MARKER_DATA.pose.position;
const targetOffset = [targetPosition.x, targetPosition.y, targetPosition.z];

function Example({
  alpha = 0.3,
  color = { r: 0.2, g: 0.59, b: 0.2, a: 0.3 },
}: {
  alpha?: number;
  color?: Color;
}) {
  const marker = MARKER_DATA;
  const markerWithoutColor = {
    ...MARKER_DATA,
    color: undefined,
    pose: {
      position: { x: -1937.7028138723192, y: 1775.5034239982174, z: 52.870026489273044 },
      orientation: { x: 0, y: 0, z: -0.9928242172830276, w: 0.11958291506876588 },
    },
  };

  const markerWithSettings = {
    ...MARKER_DATA,
    pose: {
      position: { x: -1947.7028138723192, y: 1770.5034239982174, z: 52.870026489273044 },
      orientation: { x: -0.9928242172830276, y: 0, z: 0, w: 0.11958291506876588 },
    },
    settings: {
      overrideColor: color,
      size: {
        shaftWidth: 0.5,
        headWidth: 2,
        headLength: 2,
      },
    },
  };
  const markerWithCarModel: PoseMarker = {
    ...MARKER_DATA,
    pose: {
      position: { x: -1951.7028138723192, y: 1770.5034239982174, z: 52.870026489273044 },
      orientation: { x: 0, y: 0, z: -0.9928242172830276, w: 0.11958291506876588 },
    },
    settings: {
      modelType: "car-model",
      alpha,
    },
  };

  return (
    <Worldview
      defaultCameraState={{
        ...DEFAULT_CAMERA_STATE,
        distance: 50,
        targetOffset,
        perspective: false,
      }}
      cameraMode="perspective"
      hideDebug
    >
      <PoseMarkers markers={[marker, markerWithoutColor, markerWithSettings, markerWithCarModel]} />
    </Worldview>
  );
}

storiesOf("panels/ThreeDimensionalViz/commands/PoseMarkers", module)
  .addParameters({
    chromatic: {
      // the car-model marker loads the car models asynchronously
      // we delay screenshot until some time with the hope it has loaded
      delay: 3000,
    },
    colorScheme: "dark",
  })
  .add("alpha_0.3", () => <Example alpha={0.3} />)
  .add("alpha_0.5, color_50,200,50,0.8", () => (
    <Example alpha={0.5} color={{ r: 0.2, g: 0.78, b: 0.2, a: 0.8 }} />
  ))
  .add("alpha 0.8", () => <Example alpha={0.8} />)
  .add("alpha 1", () => <Example alpha={1} />);
