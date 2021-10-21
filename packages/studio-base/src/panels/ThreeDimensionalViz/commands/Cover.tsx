// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import memoize from "lodash/memoize";
import type REGL from "regl";

import { Command } from "@foxglove/regl-worldview";
import { ReglColor } from "@foxglove/studio-base/util/colorUtils";

type Uniforms = {
  color: ReglColor;
};
type Attributes = {
  position: number[][];
};
type Props = {
  color: ReglColor;
  points: number[][];
  ["points.length"]: number;
};

const makeReglCommand = memoize(
  ({ overwriteDepthBuffer }: { overwriteDepthBuffer?: boolean }) =>
    (
      regl: REGL.Regl,
    ): REGL.DrawConfig<
      Uniforms,
      Attributes,
      Props,
      Record<string, never>,
      REGL.DefaultContext
    > => ({
      vert: `
      precision mediump float;
      attribute vec2 position;
      void main () {
        gl_Position = vec4(position, 1, 1);
      }
    `,

      frag: `
      precision mediump float;
      uniform vec4 color;
      void main () {
        gl_FragColor = color;
    }`,

      attributes: {
        position: regl.prop("points"),
      },

      uniforms: {
        color: regl.prop("color"),
      },

      count: regl.prop("points.length"),

      blend: {
        enable: true,
        func: {
          src: "src alpha",
          dst: "one minus src alpha",
        },
      },

      depth: {
        // If overwriteDepthBuffer is enabled, we will always
        // write to the depth buffer with a "far away" value of 1.
        // The result is similar to calling regl.clear({ depth: 1 }).
        enable: overwriteDepthBuffer ?? false,
        func: "always",
      },
    }),
  (...args) => JSON.stringify(args),
);

export default function Cover({
  color,
  layerIndex,
  overwriteDepthBuffer,
}: {
  color: ReglColor;
  layerIndex?: number;

  // When enabled, the cover will overwrite the depth buffer when it is drawn.
  // This is useful if you'd like to draw new content on top of the Cover.
  overwriteDepthBuffer?: boolean;
}): JSX.Element {
  // Two triangles covering the entire screen
  const points = [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [1, 1],
  ];
  return (
    <Command reglCommand={makeReglCommand({ overwriteDepthBuffer })} layerIndex={layerIndex}>
      {{ color, points }}
    </Command>
  );
}
