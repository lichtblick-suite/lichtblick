// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { range } from "lodash";

import { ImageAnnotations } from "@foxglove/schemas/schemas/typescript";
import { normalizeAnnotations } from "@foxglove/studio-base/panels/Image/lib/normalizeAnnotations";
import { ImageMarker, ImageMarkerType } from "@foxglove/studio-base/types/Messages";

function marker(type: ImageMarkerType, props: Partial<ImageMarker> = {}): ImageMarker {
  return {
    header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
    ns: "",
    id: 0,
    action: 0,
    position: { x: 0, y: 0, z: 0 },
    scale: 0,
    lifetime: { sec: 0, nsec: 0 },
    outline_color: { r: 0, g: 0, b: 0, a: 0 },
    filled: false,
    fill_color: { r: 0, g: 0, b: 0, a: 0 },
    points: [],
    outline_colors: [],
    ...props,
    type,
  };
}

function makeLines(xOffset: number) {
  return [
    { x: xOffset + 30, y: 50, z: 0 },
    { x: xOffset + 32, y: 58, z: 0 },
    { x: xOffset + 45, y: 47, z: 0 },
    { x: xOffset + 60, y: 50, z: 0 },
    { x: xOffset + 65, y: 40, z: 0 },
    { x: xOffset + 40, y: 45, z: 0 },
  ];
}

const markers: ImageMarker[] = [
  // circles
  marker(0, {
    position: { x: 40, y: 20, z: 0 },
    scale: 5,
    outline_color: { r: 1, g: 0.5, b: 0, a: 1 },
  }),
  marker(0, {
    position: { x: 55, y: 20, z: 0 },
    scale: 5,
    outline_color: { r: 1, g: 0, b: 1, a: 1 },
    fill_color: { r: 1, g: 0, b: 1, a: 1 },
    filled: true,
  }),
  // line strip
  marker(1, {
    scale: 1,
    points: [
      { x: 40, y: 20, z: 0 },
      { x: 40, y: 30, z: 0 },
      { x: 30, y: 30, z: 0 },
    ],
    outline_color: { r: 0, g: 0, b: 1, a: 1 },
  }),
  marker(1, {
    scale: 2,
    points: makeLines(0),
    outline_color: { r: 1, g: 1, b: 1, a: 1 },
  }),
  // line list
  marker(2, {
    scale: 2,
    points: makeLines(50),
    outline_color: { r: 0.5, g: 0.5, b: 1, a: 1 },
  }),
  // polygon
  marker(3, {
    scale: 2,
    points: makeLines(100),
    outline_color: { r: 0.5, g: 0.5, b: 1, a: 1 },
  }),
  marker(3, {
    scale: 2,
    points: makeLines(150),
    outline_color: { r: 0.5, g: 1, b: 0.5, a: 1 },
    fill_color: { r: 0.5, g: 1, b: 0.5, a: 1 },
    filled: true,
  }),
  marker(3, {
    scale: 1,
    points: [
      { x: 100, y: 20, z: 0 },
      { x: 120, y: 20, z: 0 },
      { x: 120, y: 30, z: 0 },
      { x: 100, y: 30, z: 0 },
    ],
    outline_color: { r: 0.5, g: 1, b: 0.5, a: 1 },
    fill_color: { r: 0.5, g: 1, b: 0.5, a: 1 },
    filled: true,
  }),
  marker(3, {
    scale: 1,
    points: [
      { x: 100, y: 20, z: 0 },
      { x: 120, y: 20, z: 0 },
      { x: 120, y: 30, z: 0 },
      { x: 100, y: 30, z: 0 },
    ],
    outline_color: { r: 0, g: 0, b: 0, a: 1 },
  }),
  marker(3, {
    scale: 1,
    points: [
      { x: 150, y: 20, z: 0 },
      { x: 170, y: 20, z: 0 },
      { x: 170, y: 30, z: 0 },
      { x: 150, y: 30, z: 0 },
    ],
    outline_color: { r: 0.5, g: 1, b: 0.5, a: 1 },
    fill_color: { r: 0.5, g: 1, b: 0.5, a: 1 },
    filled: true,
  }),
  // points
  marker(4, {
    scale: 4,
    points: range(50).map((i) => ({ x: 20 + 5 * i, y: 130 + 10 * Math.sin(i / 2), z: 0 })),
    fill_color: { r: 1, g: 0, b: 0, a: 1 },
  }),
  marker(4, {
    scale: 1,
    points: range(50).map((i) => ({ x: 20 + 5 * i, y: 150 + 10 * Math.sin(i / 2), z: 0 })),
    fill_color: { r: 0.5, g: 1, b: 0, a: 1 },
  }),
  marker(4, {
    scale: 4,
    points: range(50).map((i) => ({ x: 20 + 5 * i, y: 170 + 10 * Math.sin(i / 2), z: 0 })),
    fill_color: { r: 0, g: 0, b: 1, a: 1 },
  }),
  marker(4, {
    scale: 2,
    points: range(50).map((i) => ({ x: 20 + 5 * i, y: 190 + 10 * Math.sin(i / 2), z: 0 })),
    fill_color: { r: 0, g: 0, b: 1, a: 1 },
  }),
  marker(4, {
    scale: 2,
    points: range(50).map((i) => ({ x: 20 + 5 * i, y: 210 + 10 * Math.sin(i / 2), z: 0 })),
    outline_colors: range(50).map((i) => ({
      r: Math.min(1, (2 * i) / 50),
      g: Math.min(1, (2 * (i - 15)) / 50),
      b: Math.min(1, (2 * (i - 30)) / 50),
      a: 1,
    })),
    fill_color: { r: 0, g: 0, b: 1, a: 1 },
  }),
  // text
  marker(5, {
    text: { data: "Hello!" },
    position: { x: 30, y: 100, z: 0 },
    scale: 1,
    outline_color: { r: 1, g: 0.5, b: 0.5, a: 1 },
  }),
  marker(5, {
    text: { data: "Hello!" },
    position: { x: 130, y: 100, z: 0 },
    scale: 1,
    outline_color: { r: 1, g: 0.5, b: 0.5, a: 1 },
    filled: true,
    fill_color: { r: 50 / 255, g: 50 / 255, b: 50 / 255, a: 1 },
  }),
  // circles again
  marker(0, {
    position: { x: 30, y: 100, z: 0 },
    scale: 2,
    outline_color: { r: 1, g: 1, b: 0, a: 1 },
  }),
  marker(0, {
    position: { x: 130, y: 100, z: 0 },
    scale: 2,
    outline_color: { r: 1, g: 1, b: 0, a: 1 },
  }),
];

export const annotations =
  normalizeAnnotations({ markers }, "foxglove_msgs/ImageMarkerArray") ?? [];

const points = [
  { x: 40, y: 40 },
  { x: 70, y: 80 },
  { x: 40, y: 120 },
  { x: 110, y: 90 },
  { x: 150, y: 50 },
];
const outlineColors = [
  { r: 1, g: 0, b: 0, a: 1 },
  { r: 0, g: 1, b: 0, a: 1 },
  { r: 0, g: 0, b: 1, a: 1 },
  { r: 1, g: 1, b: 0, a: 1 },
  { r: 1, g: 0, b: 1, a: 1 },
];
export const foxgloveAnnotations: ImageAnnotations = {
  circles: [],
  points: [
    {
      timestamp: { sec: 0, nsec: 0 },
      type: 1,
      points,
      outline_colors: outlineColors,
      outline_color: { r: 1, g: 0.5, b: 0, a: 1 },
      fill_color: { r: 1, g: 0, b: 0, a: 1 },
      thickness: 10,
    },
    {
      timestamp: { sec: 0, nsec: 0 },
      type: 2,
      points: points.map(({ x, y }) => ({ x: x + 130, y })),
      outline_colors: outlineColors,
      outline_color: { r: 1, g: 0.5, b: 0, a: 1 },
      fill_color: { r: 1, g: 0, b: 0, a: 1 },
      thickness: 5,
    },
    {
      timestamp: { sec: 0, nsec: 0 },
      type: 3,
      points: points.map(({ x, y }) => ({ x, y: y + 100 })),
      outline_colors: outlineColors,
      outline_color: { r: 1, g: 0.5, b: 0, a: 1 },
      fill_color: { r: 1, g: 0, b: 0, a: 1 },
      thickness: 5,
    },
    {
      timestamp: { sec: 0, nsec: 0 },
      type: 4,
      points: points.map(({ x, y }) => ({ x: x + 130, y: y + 100 })),
      outline_colors: outlineColors,
      outline_color: { r: 1, g: 0.5, b: 0, a: 1 },
      fill_color: { r: 1, g: 0, b: 0, a: 1 },
      thickness: 5,
    },
  ],
};
