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
import {
  Command,
  withPose,
  toRGBA,
  Regl,
  CommonCommandProps,
  nonInstancedGetChildrenForHitmap,
} from "regl-worldview";

import { getGlobalHooks } from "@foxglove-studio/app/loadWebviz";
import { LaserScan } from "@foxglove-studio/app/types/Messages";

export const DEFAULT_FLAT_COLOR = { r: 0.5, g: 0.5, b: 1, a: 1 };

const laserScan = (regl: Regl) =>
  withPose({
    primitive: "points",
    vert: (getGlobalHooks() as any).perPanelHooks().ThreeDimensionalViz.LaserScanVert,
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
      pointSize: (context: never, props: any) => props.settings?.pointSize || 4,
      isCircle: (context: never, props: any) =>
        (props.settings && props.settings.pointShape === "circle") || false,
      // Color is not included in the LaserScan message - it's only included if the color is added by
      // getChildrenForHitmap.
      isHitmap: (context: never, props: any) => !!props.color,

      angle_min: regl.prop("angle_min"),
      angle_increment: regl.prop("angle_increment"),
      range_min: regl.prop("range_min"),
      range_max: regl.prop("range_max"),

      color: (context: never, props: any) =>
        toRGBA(props.settings?.overrideColor || DEFAULT_FLAT_COLOR),
    },

    attributes: {
      index: (context: never, props: any) => range(props.ranges.length),
      range: regl.prop("ranges"),
      intensity: (context: never, props: any) =>
        props.intensities.length === props.ranges.length
          ? props.intensities
          : new Float32Array(props.ranges.length).fill(1),
      hitmapColor: (context: never, props: any) =>
        new Array(props.ranges.length).fill(props.color || [0, 0, 0, 1]),
    },

    count: regl.prop("ranges.length"),
  });

type Props = CommonCommandProps & {
  children: LaserScan[];
};

export default function LaserScans(props: Props) {
  return (
    <Command
      getChildrenForHitmap={nonInstancedGetChildrenForHitmap}
      {...props}
      reglCommand={laserScan}
    />
  );
}
