// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { PackedElementField } from "@foxglove/schemas";
import { SettingsTreeFields, SettingsTreeNode, Topic } from "@foxglove/studio";
import { BaseSettings } from "@foxglove/studio-base/panels/ThreeDeeRender/settings";

import { rgbaGradient, rgbaToLinear, SRGBToLinear, stringToRgba } from "../../color";
import { clamp } from "../../math";
import type { ColorRGBA } from "../../ros";

export type ColorConverter = (output: ColorRGBA, colorValue: number) => void;

const tempColor1 = { r: 0, g: 0, b: 0, a: 0 };
const tempColor2 = { r: 0, g: 0, b: 0, a: 0 };

export interface ColorModeSettings {
  colorMode: "flat" | "gradient" | "colormap" | "rgb" | "rgba";
  flatColor: string;
  colorField?: string;
  gradient: [string, string];
  colorMap: "turbo" | "rainbow";
  explicitAlpha: number;
  rgbByteOrder: "rgba" | "bgra" | "abgr";
  minValue?: number;
  maxValue?: number;
}

export function getColorConverter<Settings extends ColorModeSettings>(
  settings: Settings,
  minValue: number,
  maxValue: number,
): ColorConverter {
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
        const t = (colorValue - minValue) / valueDelta;
        rgbaGradient(output, minColor, maxColor, t);
      };
    }
    case "colormap": {
      const valueDelta = Math.max(maxValue - minValue, Number.EPSILON);
      switch (settings.colorMap) {
        case "turbo":
          return (output: ColorRGBA, colorValue: number) => {
            const t = (colorValue - minValue) / valueDelta;
            turboCached(output, t);
            output.a = settings.explicitAlpha;
          };
        case "rainbow":
          return (output: ColorRGBA, colorValue: number) => {
            const t = (colorValue - minValue) / valueDelta;
            rainbow(output, t);
            output.a = settings.explicitAlpha;
          };
      }
      throw new Error(`Unrecognized color map: ${settings.colorMap}`);
    }
    case "rgb":
      switch (settings.rgbByteOrder) {
        default:
        case "rgba":
          return (output: ColorRGBA, colorValue: number) => {
            getColorRgb(output, colorValue);
            output.a = settings.explicitAlpha;
          };
        case "bgra":
          return (output: ColorRGBA, colorValue: number) => {
            getColorBgr(output, colorValue);
            output.a = settings.explicitAlpha;
          };
        case "abgr":
          return (output: ColorRGBA, colorValue: number) => {
            getColor0bgr(output, colorValue);
            output.a = settings.explicitAlpha;
          };
      }
    case "rgba":
      switch (settings.rgbByteOrder) {
        default:
        case "rgba":
          return getColorRgba;
        case "bgra":
          return getColorBgra;
        case "abgr":
          return getColorAbgr;
      }
  }
}

// 0xrrggbb00
function getColorRgb(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = ((num & 0xff000000) >>> 24) / 255;
  output.g = ((num & 0x00ff0000) >>> 16) / 255;
  output.b = ((num & 0x0000ff00) >>> 8) / 255;
  output.a = 1;
}

// 0xrrggbbaa
function getColorRgba(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = ((num & 0xff000000) >>> 24) / 255;
  output.g = ((num & 0x00ff0000) >>> 16) / 255;
  output.b = ((num & 0x0000ff00) >>> 8) / 255;
  output.a = ((num & 0x000000ff) >>> 0) / 255;
}

// 0xbbggrr00
function getColorBgr(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = ((num & 0x0000ff00) >>> 8) / 255;
  output.g = ((num & 0x00ff0000) >>> 16) / 255;
  output.b = ((num & 0xff000000) >>> 24) / 255;
  output.a = 1;
}

// 0xbbggrraa
function getColorBgra(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = ((num & 0x0000ff00) >>> 8) / 255;
  output.g = ((num & 0x00ff0000) >>> 16) / 255;
  output.b = ((num & 0xff000000) >>> 24) / 255;
  output.a = ((num & 0x000000ff) >>> 0) / 255;
}

// 0x00bbggrr
function getColor0bgr(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = ((num & 0x000000ff) >>> 0) / 255;
  output.g = ((num & 0x0000ff00) >>> 8) / 255;
  output.b = ((num & 0x00ff0000) >>> 16) / 255;
  output.a = 1;
}

// 0xaabbggrr
function getColorAbgr(output: ColorRGBA, colorValue: number): void {
  const num = colorValue >>> 0;
  output.r = ((num & 0x000000ff) >>> 0) / 255;
  output.g = ((num & 0x0000ff00) >>> 8) / 255;
  output.b = ((num & 0x00ff0000) >>> 16) / 255;
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

// A lookup table for the turbo() function
let TurboLookup: Float32Array | undefined;
const TURBO_LOOKUP_SIZE = 65535;

// Builds a one-time lookup table for the turbo() function then uses it to
// convert `pct` to a color
function turboCached(output: ColorRGBA, pct: number): void {
  if (!TurboLookup) {
    TurboLookup = new Float32Array(TURBO_LOOKUP_SIZE * 3);
    const tempColor = { r: 0, g: 0, b: 0, a: 0 };
    for (let i = 0; i < TURBO_LOOKUP_SIZE; i++) {
      turbo(tempColor, i / (TURBO_LOOKUP_SIZE - 1));
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
export const COLOR_FIELDS = new Set<string>(["rgb", "rgba", "bgr", "bgra", "abgr", "color"]);
export const INTENSITY_FIELDS = new Set<string>(["intensity", "i"]);

export function autoSelectColorField<Settings extends ColorModeSettings>(
  output: Settings,
  fields: PackedElementField[],
): void {
  // Prefer color fields first
  for (const field of fields) {
    const fieldNameLower = field.name.toLowerCase();
    if (COLOR_FIELDS.has(fieldNameLower)) {
      output.colorField = field.name;
      switch (fieldNameLower) {
        case "rgb":
          output.colorMode = "rgb";
          output.rgbByteOrder = "abgr";
          break;
        default:
        case "rgba":
          output.colorMode = "rgba";
          output.rgbByteOrder = "abgr";
          break;
        case "bgr":
          output.colorMode = "rgb";
          output.rgbByteOrder = "bgra";
          break;
        case "bgra":
          output.colorMode = "rgba";
          output.rgbByteOrder = "bgra";
          break;
        case "abgr":
          output.colorMode = "rgba";
          output.rgbByteOrder = "abgr";
          break;
      }
      return;
    }
  }

  // Fall back to using the first field
  if (fields.length > 0) {
    const firstField = fields[0]!;
    output.colorField = firstField.name;
    output.colorMode = "colormap";
    output.colorMap = "turbo";
    return;
  }
}

export function bestColorByField(fields: string[]): string {
  for (const field of fields) {
    if (COLOR_FIELDS.has(field)) {
      return field;
    }
  }
  for (const field of fields) {
    if (INTENSITY_FIELDS.has(field)) {
      return field;
    }
  }
  return fields.find((field) => field === "x") || fields[0] ? fields[0]! : "";
}

export function baseColorModeSettingsNode<Settings extends ColorModeSettings & BaseSettings>(
  fieldsByTopic: Map<string, string[]>,
  config: Partial<Settings>,
  topic: Topic,
  defaults: Settings,
): SettingsTreeNode {
  const msgFields = fieldsByTopic.get(topic.name) ?? [];
  const colorMode = config.colorMode ?? "flat";
  const flatColor = config.flatColor ?? "#ffffff";
  const colorField = config.colorField ?? bestColorByField(msgFields);
  const colorFieldOptions = msgFields.map((field) => ({ label: field, value: field }));
  const gradient = config.gradient;
  const colorMap = config.colorMap ?? "turbo";
  const explicitAlpha = config.explicitAlpha ?? 1;
  const rgbByteOrder = config.rgbByteOrder ?? "rgba";
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
      { label: "RGB", value: "rgb" },
      { label: "RGBA", value: "rgba" },
    ],
    value: colorMode,
  };
  if (colorMode === "flat") {
    fields.flatColor = { label: "Flat color", input: "rgba", value: flatColor };
  } else {
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
      case "rgb":
        fields.rgbByteOrder = {
          label: "RGB byte order",
          input: "select",
          options: [
            { label: "RGB", value: "rgba" },
            { label: "BGR", value: "bgra" },
            { label: "XBGR", value: "abgr" },
          ],
          value: rgbByteOrder,
        };
        break;
      case "rgba":
        fields.rgbByteOrder = {
          label: "RGBA byte order",
          input: "select",
          options: [
            { label: "RGBA", value: "rgba" },
            { label: "BGRA", value: "bgra" },
            { label: "ABGR", value: "abgr" },
          ],
          value: rgbByteOrder,
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
      // It's too expensive to check the alpha value of each color. Just assume it's transparent
      return true;
  }
}
