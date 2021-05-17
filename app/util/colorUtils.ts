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

import { Color } from "@foxglove/studio-base/types/Messages";

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
