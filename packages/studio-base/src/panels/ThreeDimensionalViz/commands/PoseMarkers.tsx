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
import { vec3 } from "gl-matrix";
import { memo, ReactElement } from "react";

import {
  Arrows,
  pointToVec3,
  vec3ToPoint,
  orientationToVec4,
  CommonCommandProps,
  Pose,
} from "@foxglove/regl-worldview";
import { InteractionData } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import { PoseSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PoseSettingsEditor";
import { Color, Header, Scale } from "@foxglove/studio-base/types/Messages";

import CarModel from "./CarModel";

type PoseMarker = {
  header: Header;
  pose: Pose;
  scale: Scale;
  color?: Color;
  interactionData?: InteractionData;
  settings?: PoseSettings;
};

type PoseMarkerProps = CommonCommandProps & {
  markers: PoseMarker[];
};

function PoseMarkers({ markers, layerIndex }: PoseMarkerProps): ReactElement {
  const models: React.ReactNode[] = [];
  const arrowMarkers: React.ReactNode[] = [];

  markers.forEach((marker, idx) => {
    const { pose, settings, interactionData } = marker;

    switch (settings?.modelType) {
      case "car-model": {
        models.push(
          <CarModel layerIndex={layerIndex} key={idx}>
            {{ pose, alpha: settings.alpha ?? 1, interactionData }}
          </CarModel>,
        );
        break;
      }
      case "arrow":
      default: {
        let newMarker = marker;
        if (settings?.overrideColor != undefined) {
          newMarker = { ...newMarker, color: settings.overrideColor };
        }

        if (settings?.size) {
          newMarker = {
            ...newMarker,
            scale: {
              x: settings.size.shaftWidth ?? marker.scale.x,
              y: settings.size.headWidth ?? marker.scale.y,
              z: settings.size.headLength ?? marker.scale.z,
            },
          };
        }

        const pos = pointToVec3(newMarker.pose.position);
        const orientation = orientationToVec4(newMarker.pose.orientation);
        const dir = vec3.transformQuat([0, 0, 0], [1, 0, 0], orientation);
        // the total length of the arrow is 4.7, we move the tail backwards by 0.88 (prev implementation)
        const tipPoint = vec3.scaleAndAdd([0, 0, 0], pos, dir, 3.82);
        const tailPoint = vec3.scaleAndAdd([0, 0, 0], pos, dir, -0.88);
        arrowMarkers.push({
          ...newMarker,
          points: [vec3ToPoint(tailPoint), vec3ToPoint(tipPoint)],
        });

        break;
      }
    }
  });

  return (
    <>
      {...models}
      <Arrows layerIndex={layerIndex} key="arrows">
        {arrowMarkers}
      </Arrows>
    </>
  );
}

export default memo(PoseMarkers);
