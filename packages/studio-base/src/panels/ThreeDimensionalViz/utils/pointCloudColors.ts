// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Color } from "@foxglove/regl-worldview";
import { PointCloud2 } from "@foxglove/studio-base/types/Messages";

export type RgbColorMode = {
  /** Specifies which named point field to pull data from */
  mode: "rgb" | "rgba";
  /**
   * Specifies how to interpret data from the field specified in `mode`. RViz always uses BGRA,
   * while Studio/Webviz historically used ABGR for little-endian clouds (and did not support
   * big-endian clouds).
   */
  rgbByteOrder?: "rgba" | "bgra" | "abgr";
  flatColor?: never;
  colorField?: never;
  minColor?: never;
  maxColor?: never;
  minValue?: never;
  maxValue?: never;
};

export type DirectColorMode =
  | RgbColorMode
  | {
      mode: "flat";
      rgbByteOrder?: never;
      flatColor: Color;
      colorField?: never;
      minColor?: never;
      maxColor?: never;
      minValue?: never;
      maxValue?: never;
    };

export type MappedColorMode =
  | {
      mode: "gradient";
      rgbByteOrder?: never;
      flatColor?: never;
      colorField: string;
      minColor: Color;
      maxColor: Color;
      minValue?: number;
      maxValue?: number;
    }
  | {
      mode: "rainbow";
      rgbByteOrder?: never;
      flatColor?: never;
      colorField: string;
      minValue?: number;
      maxValue?: number;
      minColor?: never;
      maxColor?: never;
    }
  | {
      mode: "turbo";
      rgbByteOrder?: never;
      flatColor?: never;
      colorField: string;
      minValue?: number;
      maxValue?: number;
      minColor?: never;
      maxColor?: never;
    };

export type ColorMode = DirectColorMode | MappedColorMode;

export const DEFAULT_FLAT_COLOR = { r: 1, g: 1, b: 1, a: 1 };
export const DEFAULT_MIN_COLOR = { r: 0, g: 0, b: 1, a: 1 };
export const DEFAULT_MAX_COLOR = { r: 1, g: 0, b: 0, a: 1 };
export const DEFAULT_RGB_BYTE_ORDER = "rgba";

export const DEFAULT_COLOR_FIELDS = ["intensity", "i"];

export function isRgbColorMode(mode: ColorMode): mode is RgbColorMode {
  return mode.mode === "rgb" || mode.mode === "rgba";
}
export function isMappedColorMode(mode: ColorMode): mode is MappedColorMode {
  return mode.mode === "turbo" || mode.mode === "rainbow" || mode.mode === "gradient";
}
export function isValidRgbByteOrder(
  value: string,
): value is NonNullable<RgbColorMode["rgbByteOrder"]> {
  return value === "rgba" || value === "bgra" || value === "abgr";
}

/**
 * Return the default field to be used when coloring by field value (excluding RGB/RGBA)
 */
export function getDefaultColorField(message: PointCloud2 | undefined): string | undefined {
  return (
    message?.fields.find(({ name }) => DEFAULT_COLOR_FIELDS.includes(name))?.name ??
    message?.fields.find(({ name }) => name !== "rgb" && name !== "rgba")?.name
  );
}

/**
 * Return the default color mode to be used for a given message based on data. RGB/RGBA is preferred if present. Returns undefined if no data-based color modes are supported.
 */
export function getDefaultDataColorMode(message: PointCloud2 | undefined): ColorMode | undefined {
  const hasRGB = message?.fields.some(({ name }) => name === "rgb") ?? false;
  const hasRGBA = message?.fields.some(({ name }) => name === "rgba") ?? false;
  const defaultColorField = getDefaultColorField(message);
  return hasRGBA
    ? { mode: "rgba" }
    : hasRGB
    ? { mode: "rgb" }
    : defaultColorField != undefined
    ? { mode: "turbo", colorField: defaultColorField }
    : undefined;
}

/**
 * Return the default color mode to be used for a given message. RGB/RGBA is preferred if present.
 */
export function getDefaultColorMode(message: PointCloud2 | undefined): ColorMode {
  return getDefaultDataColorMode(message) ?? { mode: "flat", flatColor: DEFAULT_FLAT_COLOR };
}
