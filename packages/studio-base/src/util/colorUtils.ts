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

import tinycolor, { ColorFormats } from "tinycolor2";

import { Color } from "@foxglove/studio-base/types/Messages";

// default color scaled (1, 1, 1, 1)
const DEFAULT_RGBA = { r: 1, g: 1, b: 1, a: 1 };

export type ReglColor = [number, number, number, number];

export const hexToReglRGB = (hex: string, alpha?: number): ReglColor => {
  const r = parseInt(hex.slice(1, 3), 16) / 255,
    g = parseInt(hex.slice(3, 5), 16) / 255,
    b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, alpha ?? 1];
};

export const hexToColorObj = (hex: string, alpha?: number): Color => {
  const [r, g, b] = hexToReglRGB(hex, alpha);
  return { r, g, b, a: alpha ?? 1 };
};

// Convert a color object (scaled to 1, 1, 1, 1) to a fluentUI IRGB by scaling
// the RGB values to 255 and the alpha to 100.
export const colorObjToRGBA = (color: Color): Color => {
  return {
    r: Math.round(255 * color.r),
    g: Math.round(255 * color.g),
    b: Math.round(255 * color.b),
    a: Math.round(100 * color.a),
  };
};

// Convert a color object to a hex color. Disregards the alpha value.
export const colorObjToHex = (color?: Color): string => {
  return tinycolor.fromRatio(color ?? DEFAULT_RGBA).toHexString();
};

// Returns an RGB string for a regl-worldview color. The scale of the formatted
// tuple is (255, 255, 255, 1).
export function defaultedRGBStringFromColorObj(color?: Color): string {
  const rgba = colorObjToRGBA(color ?? DEFAULT_RGBA);
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a / 100})`;
}

// Translate a fluentui IRGB to our internal Color interface, defaulting the
// alpha value to 1 if it is not present.
export function getColorFromIRGB(rgba: ColorFormats.RGB & { a?: number }): Color {
  const alpha = rgba.a ?? 100;
  return {
    r: rgba.r / 255,
    g: rgba.g / 255,
    b: rgba.b / 255,
    a: alpha / 100,
  };
}
