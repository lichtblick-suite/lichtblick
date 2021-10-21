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

import { GLTFScene, parseGLB, Pose, Scale, CommonCommandProps } from "@foxglove/regl-worldview";
import { InteractionData } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import carModelURL from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/CarModel/carModel.glb";

async function loadCarModel() {
  const response = await fetch(carModelURL);
  if (!response.ok) {
    throw new Error(`unable to load car model: ${response.status}`);
  }
  const model = await parseGLB(await response.arrayBuffer());
  const nodes = [...model.json.nodes];

  // overwrite the translation component of the root node so the car's center is its rear axle
  const translation: vec3 = [0, 0, 0];
  vec3.lerp(translation, model.json.accessors[1].min, model.json.accessors[1].max, 0.5);
  vec3.scale(translation, translation, -nodes[0].scale[0]);
  translation[1] += 56.075834;
  translation[2] += 136.19549;
  nodes[0] = { ...nodes[0], translation };

  return {
    ...model,
    json: {
      ...model.json,
      nodes,

      // change sampler minFilter to avoid blurry textures
      samplers: model.json.samplers.map((sampler: Record<string, unknown>) => ({
        ...sampler,
        minFilter: WebGLRenderingContext.LINEAR,
      })),
    },
  };
}

type Props = CommonCommandProps & {
  children: {
    pose: Pose;
    scale?: Scale;
    alpha?: number;
    interactionData?: InteractionData;
  };
};

// default scale is 0.01 because the model's units are centimeters
export default function CarModel({
  children: { pose, alpha = 1, scale = { x: 0.01, y: 0.01, z: 0.01 }, interactionData },
  layerIndex,
}: Props): JSX.Element {
  return (
    <GLTFScene layerIndex={layerIndex} model={loadCarModel}>
      {{ pose, alpha, scale, interactionData }}
    </GLTFScene>
  );
}
