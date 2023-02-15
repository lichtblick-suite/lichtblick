// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { SettingsTreeFields, SettingsTreeNode, Topic } from "@foxglove/studio";
import { BaseSettings } from "@foxglove/studio-base/panels/ThreeDeeRender/settings";

import { rgbaGradient, rgbaToLinear, SRGBToLinear, stringToRgba } from "../../color";
import { clamp } from "../../math";
import type { ColorRGBA } from "../../ros";

export type ColorConverter = (output: ColorRGBA, colorValue: number) => void;

const tempColor1 = { r: 0, g: 0, b: 0, a: 0 };
const tempColor2 = { r: 0, g: 0, b: 0, a: 0 };
export const NEEDS_MIN_MAX = ["gradient", "colormap"];

export interface ColorModeSettings {
  colorMode: "flat" | "gradient" | "colormap" | "rgb" | "rgba" | "rgba-fields";
  flatColor: string;
  colorField?: string;
  gradient: [string, string];
  colorMap: "turbo" | "rainbow";
  explicitAlpha: number;
  minValue?: number;
  maxValue?: number;
}

export function getColorConverter<
  Settings extends ColorModeSettings & {
    readonly colorMode: Exclude<ColorModeSettings["colorMode"], "rgba-fields">;
  },
>(settings: Settings, minValue: number, maxValue: number): ColorConverter {
  switch (settings.colorMode) {
    case "flat": {
      const flatColor = stringToRgba(tempColor1, settings.flatColor);
      rgbaToLinear(flatColor, flatColor);
      return (output: ColorRGBA, _colorValue: number) => {
        output.r = flatColor.r;
        output.g = flatColor.g;
        output.b = flatColor.b;
        output.a = flatColor.a;
      };
    }
    case "gradient": {
      const valueDelta = Math.max(maxValue - minValue, Number.EPSILON);
      const minColor = stringToRgba(tempColor1, settings.gradient[0]);
      const maxColor = stringToRgba(tempColor2, settings.gradient[1]);
      rgbaToLinear(minColor, minColor);
      rgbaToLinear(maxColor, maxColor);
      return (output: ColorRGBA, colorValue: number) => {
        const t = Math.max(0, Math.min((colorValue - minValue) / valueDelta, 1));
        rgbaGradient(output, minColor, maxColor, t);
      };
    }
    case "colormap": {
      const valueDelta = Math.max(maxValue - minValue, Number.EPSILON);
      switch (settings.colorMap) {
        case "turbo":
          return (output: ColorRGBA, colorValue: number) => {
            const t = Math.max(0, Math.min((colorValue - minValue) / valueDelta, 1));
            turboLinearCached(output, t);
            output.a = settings.explicitAlpha;
          };
        case "rainbow":
          return (output: ColorRGBA, colorValue: number) => {
            const t = Math.max(0, Math.min((colorValue - minValue) / valueDelta, 1));
            rainbowLinear(output, t);
            output.a = settings.explicitAlpha;
          };
      }
      throw new Error(`Unrecognized color map: ${settings.colorMap}`);
    }
    case "rgb":
      return (output: ColorRGBA, colorValue: number) => {
        getColorBgra(output, colorValue);
        output.a = settings.explicitAlpha;
      };
    case "rgba":
      return getColorBgra;
  }
}

// 0xaarrggbb
// Matches rviz behavior:
// https://github.com/ros-visualization/rviz/blob/a60b334fd10785a6b74893189fcebbd419d468e4/src/rviz/default_plugin/point_cloud_transformers.cpp#L383-L406
function getColorBgra(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.a = ((num & 0xff000000) >>> 24) / 255;
  output.r = ((num & 0x00ff0000) >>> 16) / 255;
  output.g = ((num & 0x0000ff00) >>> 8) / 255;
  output.b = ((num & 0x000000ff) >>> 0) / 255;
}

// taken from http://docs.ros.org/jade/api/rviz/html/c++/point__cloud__transformers_8cpp_source.html
// line 47
function rainbowLinear(output: ColorRGBA, pct: number): void {
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
function turboLinear(output: ColorRGBA, pct: number): void {
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

// A lookup table for the turbo() function
let TurboLookup: Float32Array | undefined;
const TURBO_LOOKUP_SIZE = 65535;

// Builds a one-time lookup table for the turbo() function then uses it to
// convert `pct` to a color
function turboLinearCached(output: ColorRGBA, pct: number): void {
  if (!TurboLookup) {
    TurboLookup = new Float32Array(TURBO_LOOKUP_SIZE * 3);
    const tempColor = { r: 0, g: 0, b: 0, a: 0 };
    for (let i = 0; i < TURBO_LOOKUP_SIZE; i++) {
      turboLinear(tempColor, i / (TURBO_LOOKUP_SIZE - 1));
      const offset = i * 3;
      TurboLookup[offset + 0] = tempColor.r;
      TurboLookup[offset + 1] = tempColor.g;
      TurboLookup[offset + 2] = tempColor.b;
    }
  }

  const offset = Math.trunc(pct * (TURBO_LOOKUP_SIZE - 1)) * 3;
  output.r = TurboLookup[offset + 0]!;
  output.g = TurboLookup[offset + 1]!;
  output.b = TurboLookup[offset + 2]!;
  output.a = 1;
}
export const RGBA_PACKED_FIELDS = new Set<string>(["rgb", "rgba"]);
export const INTENSITY_FIELDS = new Set<string>(["intensity", "i"]);

function bestColorByField(
  fields: string[],
  { supportsPackedRgbModes }: { supportsPackedRgbModes: boolean },
): string {
  if (supportsPackedRgbModes) {
    for (const field of fields) {
      if (RGBA_PACKED_FIELDS.has(field)) {
        return field;
      }
    }
  }
  for (const field of fields) {
    if (INTENSITY_FIELDS.has(field)) {
      return field;
    }
  }
  return fields.find((field) => field === "x") || fields[0] ? fields[0]! : "";
}

export function hasSeparateRgbaFields(fields: string[]): boolean {
  let r = false;
  let g = false;
  let b = false;
  let a = false;
  for (const field of fields) {
    switch (field) {
      case "red":
        r = true;
        break;
      case "green":
        g = true;
        break;
      case "blue":
        b = true;
        break;
      case "alpha":
        a = true;
        break;
    }
  }
  return r && g && b && a;
}

export function baseColorModeSettingsNode<Settings extends ColorModeSettings & BaseSettings>(
  msgFields: string[],
  config: Partial<Settings>,
  topic: Topic,
  defaults: Settings,
  {
    supportsPackedRgbModes,
    supportsRgbaFieldsMode,
  }: { supportsPackedRgbModes: boolean; supportsRgbaFieldsMode: boolean },
): SettingsTreeNode & { fields: NonNullable<SettingsTreeNode["fields"]> } {
  const colorMode = config.colorMode ?? "flat";
  const flatColor = config.flatColor ?? "#ffffff";
  const colorField = config.colorField ?? bestColorByField(msgFields, { supportsPackedRgbModes });
  const colorFieldOptions = msgFields.map((field) => ({ label: field, value: field }));
  const gradient = config.gradient;
  const colorMap = config.colorMap ?? "turbo";
  const explicitAlpha = config.explicitAlpha ?? 1;
  const minValue = config.minValue;
  const maxValue = config.maxValue;

  const fields: SettingsTreeFields = {};

  fields.colorMode = {
    label: "Color mode",
    input: "select",
    options: [
      { label: "Flat", value: "flat" },
      { label: "Color map", value: "colormap" },
      { label: "Gradient", value: "gradient" },
    ]
      .concat(
        supportsPackedRgbModes
          ? [
              { label: "BGR (packed)", value: "rgb" },
              { label: "BGRA (packed)", value: "rgba" },
            ]
          : [],
      )
      .concat(
        supportsRgbaFieldsMode && hasSeparateRgbaFields(msgFields)
          ? [{ label: "RGBA (separate fields)", value: "rgba-fields" }]
          : [],
      ),
    value: colorMode,
  };
  if (colorMode === "flat") {
    fields.flatColor = { label: "Flat color", input: "rgba", value: flatColor };
  } else if (colorMode !== "rgba-fields") {
    fields.colorField = {
      label: "Color by",
      input: "select",
      options: colorFieldOptions,
      value: colorField,
    };

    switch (colorMode) {
      case "gradient":
        fields.gradient = {
          label: "Gradient",
          input: "gradient",
          value: gradient ?? defaults.gradient,
        };
        break;
      case "colormap":
        fields.colorMap = {
          label: "Color map",
          input: "select",
          options: [
            { label: "Turbo", value: "turbo" },
            { label: "Rainbow", value: "rainbow" },
          ],
          value: colorMap,
        };
        break;
      default:
        break;
    }

    if (colorMode === "colormap" || colorMode === "rgb") {
      fields.explicitAlpha = {
        label: "Opacity",
        input: "number",
        step: 0.1,
        placeholder: "1",
        precision: 3,
        min: 0,
        max: 1,
        value: explicitAlpha,
      };
    }

    if (NEEDS_MIN_MAX.includes(colorMode)) {
      fields.minValue = {
        label: "Value min",
        input: "number",
        placeholder: "auto",
        precision: 4,
        value: minValue,
      };
      fields.maxValue = {
        label: "Value max",
        input: "number",
        placeholder: "auto",
        precision: 4,
        value: maxValue,
      };
    }
  }

  return {
    fields,
    order: topic.name.toLocaleLowerCase(),
    visible: config.visible ?? defaults.visible,
  };
}

const tempColor = { r: 0, g: 0, b: 0, a: 0 };
export function colorHasTransparency<Settings extends ColorModeSettings>(
  settings: Settings,
): boolean {
  switch (settings.colorMode) {
    case "flat":
      return stringToRgba(tempColor, settings.flatColor).a < 1.0;
    case "gradient":
      return (
        stringToRgba(tempColor, settings.gradient[0]).a < 1.0 ||
        stringToRgba(tempColor, settings.gradient[1]).a < 1.0
      );
    case "colormap":
    case "rgb":
      return settings.explicitAlpha < 1.0;
    case "rgba":
    case "rgba-fields":
      // It's too expensive to check the alpha value of each color. Just assume it's transparent
      return true;
  }
}

// Fragment shader chunk to convert sRGB to linear RGB. This is used by some
// PointCloud materials to avoid expensive per-point colorspace conversion on
// the CPU. Source: <https://github.com/mrdoob/three.js/blob/13b67d96/src/renderers/shaders/ShaderChunk/encodings_pars_fragment.glsl.js#L16-L18>
export const FS_SRGB_TO_LINEAR = /* glsl */ `
vec3 sRGBToLinear(in vec3 value) {
	return vec3(mix(
    pow(value.rgb * 0.9478672986 + vec3(0.0521327014), vec3(2.4)),
    value.rgb * 0.0773993808,
    vec3(lessThanEqual(value.rgb, vec3(0.04045)))
  ));
}

vec4 sRGBToLinear(in vec4 value) {
  return vec4(sRGBToLinear(value.rgb), value.a);
}
`;
