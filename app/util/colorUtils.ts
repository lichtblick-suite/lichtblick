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

import { IColor, getColorFromRGBA, IRGB } from "@fluentui/react";

import { Color } from "@foxglove/studio-base/types/Messages";

// default color scaled (1, 1, 1, 1)
const DEFAULT_RGBA = { r: 1, g: 1, b: 1, a: 1 };

export type ReglColor = [number, number, number, number];

export const hexToRgbString = (hex: string, alpha?: number): string => {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha ?? 1})`;
};

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

export const interpolate = (a: number, b: number, t: number): number => (b - a) * t + a;
export const interpolateColor = (colorA: ReglColor, colorB: ReglColor, t: number): ReglColor => {
  const [rA, gA, bA, aA] = colorA;
  const [rB, gB, bB, aB] = colorB;
  return [
    interpolate(rA, rB, t),
    interpolate(gA, gB, t),
    interpolate(bA, bB, t),
    interpolate(aA, aB, t),
  ];
};

// Converts a string like "rgb(r,g,b)" to a regl number array [r,g,b,a]
// Any component that fails to convert is replaced with a 1
export const rgbStrToReglRGB = (numberStr: string, alpha?: number): ReglColor => {
  const [_, r = "1", g = "1", b = "1", a = "1"] =
    numberStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*(\d+\.?\d+)?\s*\)/) ?? [];
  return [
    parseFloat(r) / 255,
    parseFloat(g) / 255,
    parseFloat(b) / 255,
    alpha ?? parseFloat(a) ?? 1,
  ];
};

// Convert a color object (scaled to 1, 1, 1, 1) to a fluentUI IRGB by scaling
// the RGB values to 255 and the alpha to 100.
export const colorObjToIRGB = (color: Color): IRGB => {
  return {
    r: Math.round(255 * color.r),
    g: Math.round(255 * color.g),
    b: Math.round(255 * color.b),
    a: Math.round(100 * color.a),
  };
};

// Convert a color object to a FluentUI IColor. Disregards the alpha value.
export const colorObjToIColor = (color?: Color): IColor => {
  return getColorFromRGBA(colorObjToIRGB(color ?? DEFAULT_RGBA));
};

// Returns an RGB string for a regl-worldview color. The scale of the formatted
// tuple is (255, 255, 255, 1).
export function defaultedRGBStringFromColorObj(color?: Color): string {
  const rgba = colorObjToIRGB(color ?? DEFAULT_RGBA);
  const alpha = rgba.a ?? 100;
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha / 100})`;
}

// Translate a fluentui IRGB to our internal Color interface, defaulting the
// alpha value to 1 if it is not present.
export function getColorFromIRGB(rgba: IRGB): Color {
  const alpha = rgba.a ?? 100;
  return {
    r: rgba.r / 255,
    g: rgba.g / 255,
    b: rgba.b / 255,
    a: alpha / 100,
  };
}
