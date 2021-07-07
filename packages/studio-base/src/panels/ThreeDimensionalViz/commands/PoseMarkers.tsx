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
  FilledPolygons,
  pointToVec3,
  vec3ToPoint,
  orientationToVec4,
  CommonCommandProps,
  Pose,
} from "regl-worldview";

import { InteractionData } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import { PoseSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PoseSettingsEditor";
import { Color, Header, Scale } from "@foxglove/studio-base/types/Messages";

import CarModel from "./CarModel";
import carOutlinePoints from "./CarModel/carOutline.json";

const originalScaling = {
  x: 1,
  y: 1,
};

const getScaledCarOutlineBufferPoints = (scaling: { x: number; y: number }) => {
  const vectorSum = carOutlinePoints.reduce(
    (prev, curr) => {
      prev.x += curr.x;
      prev.y += curr.y;
      prev.z += curr.z;
      return prev;
    },
    { x: 0, y: 0, z: 0 },
  );

  const vectorAverage = {
    x: vectorSum.x / carOutlinePoints.length,
    y: vectorSum.y / carOutlinePoints.length,
    z: 0,
  };
  const scaledVectorAverage = {
    x: vectorAverage.x * scaling.x,
    y: vectorAverage.y * scaling.y,
    z: 0,
  };

  const transform_x = scaledVectorAverage.x - vectorAverage.x;
  const transform_y = scaledVectorAverage.y - vectorAverage.y;

  const scaledAndTransformedPoints = carOutlinePoints.map(({ x, y, z }) => ({
    x: x * scaling.x - transform_x,
    y: y * scaling.y - transform_y,
    z,
  }));

  return scaledAndTransformedPoints;
};

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
  const scaledCarOutlineBufferPoints = React.useMemo(
    () => getScaledCarOutlineBufferPoints(originalScaling),
    [],
  );
  const models: React.ReactNode[] = [];
  const filledPolygons: React.ReactNode[] = [];
  const arrowMarkers: React.ReactNode[] = [];

  markers.forEach((marker, idx) => {
    const { pose, settings, interactionData } = marker;
    if (settings?.addCarOutlineBuffer ?? false) {
      filledPolygons.push({
        pose,
        interactionData,
        points: scaledCarOutlineBufferPoints,
        color: { r: 0.6666, g: 0.6666, b: 0.6666, a: 1 },
      });
    }

    switch (settings?.modelType) {
      case "car-outline": {
        filledPolygons.push({
          pose,
          interactionData,
          points: carOutlinePoints,
          color: settings.overrideColor ?? { r: 0.3313, g: 0.3313, b: 0.3375, a: 1 },
        });
        break;
      }
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
      <FilledPolygons layerIndex={layerIndex} key={`cruise-pose`}>
        {filledPolygons}
      </FilledPolygons>
      {...models}
      <Arrows layerIndex={layerIndex} key="arrows">
        {arrowMarkers}
      </Arrows>
    </>
  );
}

export default memo(PoseMarkers);
