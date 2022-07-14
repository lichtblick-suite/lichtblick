// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as base64 from "@protobufjs/base64";

import type { Time } from "@foxglove/rostime";
import type { MessageEvent } from "@foxglove/studio";

import { stringToRgba } from "../color";
import type { ColorRGBA, Marker, Point } from "../ros";
import type { Pose } from "../transforms";

// ts-prune-ignore-next
export type MarkerArgs = {
  id: number;
  stamp: Time;
  frame_id: string;
  colorHex: string;
  description?: string;
  ns?: string;
  frame_locked?: boolean;
  pose?: Pose;
  scale?: Point;
  receiveTime?: Time;
  lifetime?: Time;
};

// ts-prune-ignore-next
export const SENSOR_FRAME_ID = "sensor";
// ts-prune-ignore-next
export const BASE_LINK_FRAME_ID = "base_link";
// ts-prune-ignore-next
export const FIXED_FRAME_ID = "map";

// ts-prune-ignore-next
export const VEC3_ZERO = { x: 0, y: 0, z: 0 };
// ts-prune-ignore-next
export const VEC3_HALF = { x: 0.5, y: 0.5, z: 0.5 };
// ts-prune-ignore-next
export const VEC3_3_4 = { x: 0.75, y: 0.75, z: 0.75 };
// ts-prune-ignore-next
export const QUAT_IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

// ts-prune-ignore-next
export const TEST_COLORS = {
  MARKER_GREEN1: "#296019",
  MARKER_GREEN2: "#65C83B",
  MARKER_GREEN3: "#B8F9AE",

  MARKER_RED1: "#910000",
  MARKER_RED2: "#D32431",
  MARKER_RED3: "#FF6B6B",
};

const PNG_TEST_IMAGE_BASE64 =
  "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gGgAQDQAiAYARAOAaAAQDQCIBgDRACAaABANAKIBQDQAIBoARAOAaABANACIBgBEA4BoABANAIgGANEAIBoAEA0AogGgEg0AiAYA0QAgGgAQDQCiAQDRACAaAEQDAKIBQDQAiAYARAOAaAAQDQCIBgDRACAaABANAKIBANEAIBoARAMAogFANACIBgBEA4BoABANAIgGANEAgGgAEA0AogEA0QAgGgBEAwCiAUA0AIgGAEQDgGgAQDQAiAYA0QCAaAAQDQCiAQDRACAaAEQDAKIBQDQAiAYARAOAaABANACIBgDRAIBoABANAKIBANEAIBoARAMAogFANAAgGgBEA4BoAEA0AIgGANEAgGgAEA0AogEA0QAgGgBEAwCiAUA0ACAaAEQDgGgAQDQAiAYA0QCAaAAQDQCiAQDRACAaABANAKIBQDQAIBoARAOAaABANACIBgDRAIBoABANAKIBANEAIBoAEA0AogFANAAgGgBEA4BoAEA0AIgGANEAgGgAEA0AiAYA0QAgGgAQDQCiAUA0ACAaAEQDgGgAQDQAiAYARAOAaAAQDQCIBgDRACAaABANAKIBQDQAIBoARAOAaABANACIBgBEA4BoABANAIgGANEAIBoAEA0AogFANAAgGgBEAwCiAUA0AIgGAEQDgGgAEA0AiAYA0QAgGgAQDQCiAUA0ACAaAEQDAKIBQDQAiAYARAOAaAAQDQCIBgDRACAaABANAKIBANEAIBoARAMAogFANACIBgBEA4BoABANAIgGANEAIBoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABg5BMsx4VVAPgdJ4ZVIM4gDT62AAAAAElFTkSuQmCC";
// ts-prune-ignore-next
export const PNG_TEST_IMAGE = new Uint8Array(base64.length(PNG_TEST_IMAGE_BASE64));
base64.decode(PNG_TEST_IMAGE_BASE64, PNG_TEST_IMAGE, 0);

// ts-prune-ignore-next
export const STL_CUBE_MESH_RESOURCE = encodeURI(`data:model/stl;utf8,solid AssimpScene
facet normal 0 0 -1 outer loop vertex -0.5 -0.5 -0.5 vertex -0.5 0.5 -0.5 vertex 0.5 0.5 -0.5 endloop endfacet
facet normal 0 0 -1 outer loop vertex 0.5 0.5 -0.5 vertex 0.5 -0.5 -0.5 vertex -0.5 -0.5 -0.5 endloop endfacet
facet normal 0 0 1 outer loop vertex 0.5 -0.5 0.5 vertex 0.5 0.5 0.5 vertex -0.5 0.5 0.5 endloop endfacet
facet normal 0 0 1 outer loop vertex -0.5 0.5 0.5 vertex -0.5 -0.5 0.5 vertex 0.5 -0.5 0.5 endloop endfacet
facet normal 0 1 0 outer loop vertex -0.5 0.5 0.5 vertex 0.5 0.5 0.5 vertex 0.5 0.5 -0.5 endloop endfacet
facet normal 0 1 0 outer loop vertex 0.5 0.5 -0.5 vertex -0.5 0.5 -0.5 vertex -0.5 0.5 0.5 endloop endfacet
facet normal 1 0 0 outer loop vertex 0.5 0.5 0.5 vertex 0.5 -0.5 0.5 vertex 0.5 -0.5 -0.5 endloop endfacet
facet normal 1 0 0 outer loop vertex 0.5 -0.5 -0.5 vertex 0.5 0.5 -0.5 vertex 0.5 0.5 0.5 endloop endfacet
facet normal 0 -1 0 outer loop vertex 0.5 -0.5 0.5 vertex -0.5 -0.5 0.5 vertex -0.5 -0.5 -0.5 endloop endfacet
facet normal 0 -1 0 outer loop vertex -0.5 -0.5 -0.5 vertex 0.5 -0.5 -0.5 vertex 0.5 -0.5 0.5 endloop endfacet
facet normal -1 0 0 outer loop vertex -0.5 -0.5 0.5 vertex -0.5 0.5 0.5 vertex -0.5 0.5 -0.5 endloop endfacet
facet normal -1 0 0 outer loop vertex -0.5 0.5 -0.5 vertex -0.5 -0.5 -0.5 vertex -0.5 -0.5 0.5 endloop endfacet
endsolid AssimpScene`);

// ts-prune-ignore-next
export function makeColor(hex: string, alpha?: number): ColorRGBA {
  const color = stringToRgba({ r: 0, g: 0, b: 0, a: 1 }, hex);
  if (alpha != undefined) {
    color.a = alpha;
  }
  return color;
}

// ts-prune-ignore-next
export function rgba(r: number, g: number, b: number, a: number): number {
  return (
    (Math.trunc(r * 255) << 24) |
    (Math.trunc(g * 255) << 16) |
    (Math.trunc(b * 255) << 8) |
    Math.trunc(a * 255)
  );
}

// ts-prune-ignore-next
export function makePass({
  id,
  stamp,
  frame_id,
  colorHex,
  description,
  ns = "pass",
  frame_locked = false,
  pose = { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
  scale = VEC3_HALF,
  receiveTime = { sec: 10, nsec: 0 },
  lifetime = { sec: 0, nsec: 0 },
}: MarkerArgs): MessageEvent<Marker> {
  return {
    topic: "/markers",
    receiveTime,
    message: {
      header: { seq: 0, stamp, frame_id },
      id,
      ns,
      type: 1,
      action: 0,
      frame_locked,
      pose,
      scale,
      color: makeColor(colorHex, 0.25),
      lifetime,
      text: `pass${id}${description ? `: ${description}` : ""}`,
      points: [],
      colors: [],
      mesh_resource: "",
      mesh_use_embedded_materials: false,
    },
    sizeInBytes: 0,
  };
}

// ts-prune-ignore-next
export function makeFail({
  id,
  stamp,
  frame_id,
  colorHex,
  description,
  ns = "fail",
  frame_locked = false,
  pose = { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
  scale = VEC3_3_4,
  receiveTime = { sec: 10, nsec: 0 },
  lifetime = { sec: 0, nsec: 0 },
}: MarkerArgs): MessageEvent<Marker> {
  return {
    topic: "/markers",
    receiveTime,
    message: {
      header: { seq: 0, stamp, frame_id },
      id,
      ns,
      type: 1,
      action: 0,
      frame_locked,
      pose,
      scale,
      color: makeColor(colorHex, 0.75),
      lifetime,
      text: `fail${id}${description ? `: ${description}` : ""}`,
      points: [],
      colors: [],
      mesh_resource: "",
      mesh_use_embedded_materials: false,
    },
    sizeInBytes: 0,
  };
}
