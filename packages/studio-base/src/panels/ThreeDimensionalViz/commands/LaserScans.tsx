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

import { range } from "lodash";
import type REGL from "regl";

import {
  Command,
  withPose,
  toRGBA,
  CommonCommandProps,
  nonInstancedGetChildrenForHitmap,
} from "@foxglove/regl-worldview";
import { LaserScanSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/LaserScanSettingsEditor";
import { LaserScan } from "@foxglove/studio-base/types/Messages";
import { ReglColor } from "@foxglove/studio-base/util/colorUtils";

export const DEFAULT_FLAT_COLOR = { r: 0.5, g: 0.5, b: 1, a: 1 };

const LaserScanVert = `
  precision mediump float;

  uniform mat4 projection, view;

  #WITH_POSE

  uniform float pointSize;
  uniform float angle_min;
  uniform float angle_increment;
  uniform float range_min;
  uniform float range_max;
  uniform bool isHitmap;
  uniform vec4 color;

  attribute float index;
  attribute float range;
  attribute float intensity;
  attribute vec4 hitmapColor;

  varying vec4 vColor;

  void main () {
    float angle = angle_min + index * angle_increment;
    vec3 p = applyPose(vec3(range * cos(angle), range * sin(angle), 0));

    gl_Position = projection * view * vec4(p, 1);
    gl_PointSize = pointSize;

    if (range < range_min || range > range_max || intensity == 0.0) {
      gl_PointSize = 0.;
    }
    vColor = isHitmap ? hitmapColor : color;
  }
`;

type Uniforms = {
  pointSize: number;
  angle_min: number;
  angle_increment: number;
  range_min: number;
  range_max: number;
  isHitmap: boolean;
  isCircle: boolean;
  color: number[];
};
type Attributes = {
  index: readonly number[];
  range: readonly number[];
  intensity: ArrayLike<number>;
  hitmapColor: number[][];
};
type OwnContext = Record<string, never>;
type CommandProps = LaserScan & {
  color?: ReglColor;
  settings?: LaserScanSettings;
};

const laserScan = (regl: REGL.Regl) =>
  withPose<Uniforms, Attributes, CommandProps, OwnContext, REGL.DefaultContext>({
    primitive: "points",
    vert: LaserScanVert,
    frag: `
  precision mediump float;
  varying vec4 vColor;
  uniform bool isCircle;
  void main () {
    if (isCircle && length(gl_PointCoord * 2.0 - 1.0) > 1.0) {
      discard;
    }

    gl_FragColor = vColor;
  }
  `,

    uniforms: {
      pointSize: (_context, props) => props.settings?.pointSize ?? 4,
      isCircle: (_context, props) =>
        (props.settings && props.settings.pointShape === "circle") || false,
      // Color is not included in the LaserScan message - it's only included if the color is added by
      // getChildrenForHitmap.
      isHitmap: (_context, props) => !!props.color,

      angle_min: regl.prop("angle_min"),
      angle_increment: regl.prop("angle_increment"),
      range_min: regl.prop("range_min"),
      range_max: regl.prop("range_max"),

      color: (_context, props) => toRGBA(props.settings?.overrideColor ?? DEFAULT_FLAT_COLOR),
    },

    attributes: {
      index: (_context, props) => range(props.ranges.length),
      range: regl.prop("ranges"),
      intensity: (_context, props) =>
        props.intensities.length === props.ranges.length
          ? props.intensities
          : new Float32Array(props.ranges.length).fill(1),
      hitmapColor: (_context, props) =>
        new Array(props.ranges.length).fill(props.color ?? [0, 0, 0, 1]),
    },

    count: regl.prop("ranges.length"),
  });

type Props = CommonCommandProps & {
  // TypeScript doesn't allow us to pass an array variable if `children` is set to an array type here
  // https://github.com/microsoft/TypeScript/issues/30711#issuecomment-485013588
  children: React.ReactNode;
};

export default function LaserScans(props: Props): JSX.Element {
  return (
    <Command
      getChildrenForHitmap={nonInstancedGetChildrenForHitmap}
      {...props}
      reglCommand={laserScan}
    />
  );
}
