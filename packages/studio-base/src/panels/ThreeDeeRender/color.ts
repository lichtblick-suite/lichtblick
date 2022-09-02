// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import tinycolor from "tinycolor2";

import { lerp } from "./math";
import { ColorRGB, ColorRGBA } from "./ros";

export const LIGHT_OUTLINE = new THREE.Color(0x000000).convertSRGBToLinear();
export const DARK_OUTLINE = new THREE.Color(0xffffff).convertSRGBToLinear();

// From https://github.com/mrdoob/three.js/blob/dev/src/math/ColorManagement.js
// which is not exported
export function SRGBToLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

export function stringToRgba(output: ColorRGBA, colorStr: string): ColorRGBA {
  const color = tinycolor(colorStr);
  if (!color.isValid()) {
    output.r = output.g = output.b = output.a = 1;
    return output;
  }
  const rgb = color.toRgb();
  output.r = rgb.r / 255;
  output.g = rgb.g / 255;
  output.b = rgb.b / 255;
  output.a = rgb.a;
  return output;
}

export function makeRgba(): ColorRGBA {
  return { r: 0, g: 0, b: 0, a: 0 };
}

export function stringToRgb<T extends ColorRGB | THREE.Color>(output: T, colorStr: string): T {
  const color = tinycolor(colorStr);
  if (!color.isValid()) {
    output.r = output.g = output.b = 1;
    return output;
  }
  const rgb = color.toRgb();
  output.r = rgb.r / 255;
  output.g = rgb.g / 255;
  output.b = rgb.b / 255;
  return output;
}

/** Converts a ColorRGB to THREE.Color and converts from sRGB to linear RGB. */
export function rgbToThreeColor(output: THREE.Color, rgb: ColorRGB): THREE.Color {
  return output.setRGB(rgb.r, rgb.g, rgb.b).convertSRGBToLinear();
}

// ts-prune-ignore-next
export function rgbaToHexString(color: ColorRGBA): string {
  const rgba =
    (THREE.MathUtils.clamp(color.r * 255, 0, 255) << 24) ^
    (THREE.MathUtils.clamp(color.g * 255, 0, 255) << 16) ^
    (THREE.MathUtils.clamp(color.b * 255, 0, 255) << 8) ^
    (THREE.MathUtils.clamp(color.a * 255, 0, 255) << 0);
  return ("00000000" + rgba.toString(16)).slice(-8);
}

export function rgbaToCssString(color: ColorRGBA): string {
  const r = Math.trunc(color.r * 255);
  const g = Math.trunc(color.g * 255);
  const b = Math.trunc(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${color.a})`;
}

export function rgbaToLinear(output: ColorRGBA, color: ColorRGBA): ColorRGBA {
  output.r = SRGBToLinear(color.r);
  output.g = SRGBToLinear(color.g);
  output.b = SRGBToLinear(color.b);
  output.a = color.a;
  return output;
}

// https://stackoverflow.com/a/596243
export function getLuminance(r: number, g: number, b: number): number {
  return Math.hypot(0.5468 * r, 0.7662 * g, 0.3376 * b);
}

/**
 * Computes a gradient step from colors `a` to `b` using pre-multiplied alpha to
 * match CSS linear gradients. The inputs are assumed to not have pre-multiplied
 * alpha, and the output will have pre-multiplied alpha.
 */
export function rgbaGradient(output: ColorRGBA, a: ColorRGBA, b: ColorRGBA, t: number): ColorRGBA {
  const aR = a.r * a.a;
  const aG = a.g * a.a;
  const aB = a.b * a.a;
  const bR = b.r * b.a;
  const bG = b.g * b.a;
  const bB = b.b * b.a;

  output.r = lerp(aR, bR, t);
  output.g = lerp(aG, bG, t);
  output.b = lerp(aB, bB, t);
  output.a = lerp(a.a, b.a, t);
  return output;
}
