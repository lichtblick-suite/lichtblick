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

import {
  Command,
  withPose,
  pointToVec3,
  defaultBlend,
  CommonCommandProps,
} from "@foxglove/regl-worldview";
import {
  defaultMapPalette,
  TextureCache,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/utils";
import { OccupancyGridMessage } from "@foxglove/studio-base/types/Messages";

type Uniforms = {
  offset: number[];
  orientation: number[];
  width: number;
  height: number;
  resolution: number;
  alpha: number;
  palette: REGL.Texture2D;
  data: REGL.Texture2D;
};
type Attributes = {
  point: REGL.Buffer;
};
type CommandProps = OccupancyGridMessage;

const occupancyGrids = (regl: REGL.Regl) => {
  // make a buffer holding the verticies of a 1x1 plane
  // it will be resized in the shader
  const positionBuffer = regl.buffer([0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0]);

  const cache = new TextureCache(regl);
  const paletteTextures = new Map<Uint8Array, REGL.Texture2D>();

  return withPose<Uniforms, Attributes, CommandProps, Record<string, never>, REGL.DefaultContext>({
    primitive: "triangle strip",

    vert: `
    precision lowp float;

    uniform mat4 projection, view;
    uniform vec3 offset;
    uniform vec4 orientation;
    uniform float width, height, resolution, alpha;

    attribute vec3 point;

    #WITH_POSE

    varying vec2 uv;
    varying float vAlpha;

    void main () {
      // set the texture uv to the unscaled vertext point
      uv = vec2(point.x, point.y);

      // compute the plane vertex dimensions
      float planeWidth = width * resolution;
      float planeHeight = height * resolution;

      // rotate the point by the ogrid orientation & scale the point by the plane vertex dimensions
      vec3 position = rotate(point * vec3(planeWidth, planeHeight, 1.), orientation);

      // move the vertex by the marker offset
      vec3 loc = applyPose(position + offset);
      vAlpha = alpha;
      gl_Position = projection * view * vec4(loc, 1);
    }
    `,
    frag: `
    precision lowp float;

    varying vec2 uv;
    varying float vAlpha;

    uniform sampler2D palette;
    uniform sampler2D data;

    void main () {
      // look up the point in our data texture corresponding to
      // the current point being shaded
      vec4 point = texture2D(data, uv);

      // vec2(point.a, 0.5) is similar to textelFetch for webGL 1.0
      // it looks up a point along our 1 dimentional palette
      // http://www.lighthouse3d.com/tutorials/glsl-tutorial/texture-coordinates/
      gl_FragColor = texture2D(palette, vec2(point.a, 0.5));
      gl_FragColor.a *= vAlpha;
    }
    `,
    blend: defaultBlend,

    depth: { enable: true, mask: false },

    attributes: {
      point: positionBuffer,
    },

    uniforms: {
      width: regl.prop("info.width"),
      height: regl.prop("info.height"),
      resolution: regl.prop("info.resolution"),
      // make alpha a uniform so in the future it can be controlled by topic settings
      alpha: (_context, props) => {
        return props.alpha ?? 0.5;
      },
      offset: (_context, props) => {
        return pointToVec3(props.info.origin.position);
      },
      orientation: (_context, props) => {
        const { x, y, z, w } = props.info.origin.orientation;
        return [x, y, z, w];
      },
      palette: (_context: unknown, _props: OccupancyGridMessage) => {
        const palette = defaultMapPalette;
        // track which palettes we've uploaded as textures
        let texture = paletteTextures.get(palette);
        if (texture) {
          return texture;
        }
        // if we haven't already uploaded this palette, upload it to the GPU
        texture = regl.texture({
          format: "rgba",
          type: "uint8",
          mipmap: false,
          data: palette,
          width: 256,
          height: 1,
        });
        paletteTextures.set(palette, texture);
        return texture;
      },
      data: (_context: unknown, props: OccupancyGridMessage) => {
        return cache.get(props);
      },
    },

    count: 4,
  });
};

type Props = CommonCommandProps & {
  // TypeScript doesn't allow us to pass an array variable if `children` is set to an array type here
  // https://github.com/microsoft/TypeScript/issues/30711#issuecomment-485013588
  children: React.ReactNode;
};

export default function OccupancyGrids(props: Props): JSX.Element {
  // We can click through OccupancyGrids.
  return <Command getChildrenForHitmap={undefined} {...props} reglCommand={occupancyGrids} />;
}
