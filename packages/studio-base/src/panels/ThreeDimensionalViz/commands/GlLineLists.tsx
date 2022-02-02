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

import type REGL from "regl";

import { Command, defaultBlend, CommonCommandProps } from "@foxglove/regl-worldview";
import { GlLineListMarker } from "@foxglove/studio-base/types/Messages";

type Uniforms = {
  color: Float32Array;
};
type Attributes = {
  point: Float32Array;
};
type CommandProps = GlLineListMarker;

const rawCommand = (regl: REGL.Regl) => {
  return regl<Uniforms, Attributes, CommandProps, Record<string, never>, REGL.DefaultContext>({
    primitive: "lines",

    vert: `
    precision lowp float;

    uniform mat4 projection, view;
    attribute vec3 point;

    void main () {
      gl_Position = projection * view * vec4(point, 1);
    }
    `,
    frag: `
    precision lowp float;
    uniform vec4 color;
    void main () {
      gl_FragColor = color;
    }
    `,
    blend: defaultBlend,

    depth: { enable: true, mask: true },

    attributes: {
      point: regl.prop("points"),
    },

    uniforms: {
      color: regl.prop("color"),
    },

    count: (_ctx, props) => props.points.length / 3,
  });
};

type Props = CommonCommandProps & {
  glLineLists: GlLineListMarker[];
};

export default function GlLineLists(props: Props): JSX.Element {
  return (
    <Command getChildrenForHitmap={undefined} {...props} reglCommand={rawCommand}>
      {props.glLineLists}
    </Command>
  );
}
