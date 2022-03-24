// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { ColorRGBA } from "../../ros";
import { PointCloudColorMode, PointCloudSettings } from "./settings";

export type ColorConverter = (output: ColorRGBA, colorValue: number) => void;

export function getColorConverter(
  settings: PointCloudSettings,
  minValue: number,
  maxValue: number,
): ColorConverter {
  const valueDelta = maxValue - minValue;
  switch (settings.colorMode) {
    case PointCloudColorMode.Flat:
      return (output: ColorRGBA, _colorValue: number) => {
        output.r = SRGBToLinear(settings.flatColor.r);
        output.g = SRGBToLinear(settings.flatColor.g);
        output.b = SRGBToLinear(settings.flatColor.b);
        output.a = settings.flatColor.a;
      };
    case PointCloudColorMode.Gradient:
      return (output: ColorRGBA, colorValue: number) => {
        const t = (colorValue - minValue) / valueDelta;
        output.r = SRGBToLinear(lerp(settings.minColor.r, settings.maxColor.r, t));
        output.g = SRGBToLinear(lerp(settings.minColor.g, settings.maxColor.g, t));
        output.b = SRGBToLinear(lerp(settings.minColor.b, settings.maxColor.b, t));
        output.a = lerp(settings.minColor.a, settings.maxColor.a, t);
      };
    case PointCloudColorMode.Rainbow:
      return (output: ColorRGBA, colorValue: number) => {
        const t = (colorValue - minValue) / valueDelta;
        rainbow(output, t);
      };
    case PointCloudColorMode.Rgb:
      switch (settings.rgbByteOrder) {
        default:
        case "rgba":
          return getColorRgb;
        case "bgra":
          return getColorBgr;
        case "abgr":
          return getColor0bgr;
      }
    case PointCloudColorMode.Rgba:
      switch (settings.rgbByteOrder) {
        default:
        case "rgba":
          return getColorRgba;
        case "bgra":
          return getColorBgra;
        case "abgr":
          return getColorAbgr;
      }
    case PointCloudColorMode.Turbo:
      return (output: ColorRGBA, colorValue: number) => {
        const t = (colorValue - minValue) / valueDelta;
        turbo(output, t);
      };
  }
}

export function SRGBToLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

// 0xrrggbb00
function getColorRgb(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = SRGBToLinear(((num & 0xff000000) >>> 24) / 255);
  output.g = SRGBToLinear(((num & 0x00ff0000) >>> 16) / 255);
  output.b = SRGBToLinear(((num & 0x0000ff00) >>> 8) / 255);
  output.a = 1;
}

// 0xrrggbbaa
function getColorRgba(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = SRGBToLinear(((num & 0xff000000) >>> 24) / 255);
  output.g = SRGBToLinear(((num & 0x00ff0000) >>> 16) / 255);
  output.b = SRGBToLinear(((num & 0x0000ff00) >>> 8) / 255);
  output.a = ((num & 0x000000ff) >>> 0) / 255;
}

// 0xbbggrr00
function getColorBgr(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = SRGBToLinear(((num & 0x0000ff00) >>> 8) / 255);
  output.g = SRGBToLinear(((num & 0x00ff0000) >>> 16) / 255);
  output.b = SRGBToLinear(((num & 0xff000000) >>> 24) / 255);
  output.a = 1;
}

// 0xbbggrraa
function getColorBgra(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = SRGBToLinear(((num & 0x0000ff00) >>> 8) / 255);
  output.g = SRGBToLinear(((num & 0x00ff0000) >>> 16) / 255);
  output.b = SRGBToLinear(((num & 0xff000000) >>> 24) / 255);
  output.a = ((num & 0x000000ff) >>> 0) / 255;
}

// 0x00bbggrr
function getColor0bgr(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = SRGBToLinear(((num & 0x000000ff) >>> 0) / 255);
  output.g = SRGBToLinear(((num & 0x0000ff00) >>> 8) / 255);
  output.b = SRGBToLinear(((num & 0x00ff0000) >>> 16) / 255);
  output.a = 1;
}

// 0xaabbggrr
function getColorAbgr(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = SRGBToLinear(((num & 0x000000ff) >>> 0) / 255);
  output.g = SRGBToLinear(((num & 0x0000ff00) >>> 8) / 255);
  output.b = SRGBToLinear(((num & 0x00ff0000) >>> 16) / 255);
  output.a = ((num & 0xff000000) >>> 24) / 255;
}

// taken from http://docs.ros.org/jade/api/rviz/html/c++/point__cloud__transformers_8cpp_source.html
// line 47
function rainbow(output: ColorRGBA, pct: number): void {
  const h = (1.0 - clamp(pct, 0, 1)) * 5.0 + 1.0;
  const i = Math.floor(h);
  let f = h % 1;
  // if i is even
  if (i % 2 < 1) {
    f = 1.0 - f;
  }
  const n = SRGBToLinear(1.0 - f);
  if (i <= 1) {
    output.r = n;
    output.g = 0;
    output.b = 1;
  } else if (i === 2) {
    output.r = 0;
    output.g = n;
    output.b = 1;
  } else if (i === 3) {
    output.r = 0;
    output.g = 1;
    output.b = n;
  } else if (i === 4) {
    output.r = n;
    output.g = 1;
    output.b = 0;
  } else {
    output.r = 1;
    output.g = n;
    output.b = 0;
  }
  output.a = 1;
}

const kRedVec4 = new THREE.Vector4(0.13572138, 4.6153926, -42.66032258, 132.13108234);
const kGreenVec4 = new THREE.Vector4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
const kBlueVec4 = new THREE.Vector4(0.1066733, 12.64194608, -60.58204836, 110.36276771);
const kRedVec2 = new THREE.Vector2(-152.94239396, 59.28637943);
const kGreenVec2 = new THREE.Vector2(4.27729857, 2.82956604);
const kBlueVec2 = new THREE.Vector2(-89.90310912, 27.34824973);
const v4 = new THREE.Vector4();
const v2 = new THREE.Vector2();

// adapted from https://gist.github.com/mikhailov-work/0d177465a8151eb6ede1768d51d476c7
function turbo(output: ColorRGBA, pct: number): void {
  // Clamp the input between [0.0, 1.0], then scale to the range [0.01, 1.0]
  const x = clamp(pct, 0.0, 1.0) * 0.99 + 0.01;
  v4.set(1, x, x * x, x * x * x);
  v2.set(v4.z, v4.w);
  v2.multiplyScalar(v4.z);
  output.r = SRGBToLinear(clamp(v4.dot(kRedVec4) + v2.dot(kRedVec2), 0, 1));
  output.g = SRGBToLinear(clamp(v4.dot(kGreenVec4) + v2.dot(kGreenVec2), 0, 1));
  output.b = SRGBToLinear(clamp(v4.dot(kBlueVec4) + v2.dot(kBlueVec2), 0, 1));
  output.a = 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
