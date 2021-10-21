// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { omit, difference, isEmpty, isNil } from "lodash";

import { toRGBA, Color } from "@foxglove/regl-worldview";
import {
  DEFAULT_FLAT_COLOR,
  DEFAULT_MIN_COLOR,
  DEFAULT_MAX_COLOR,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PointCloudSettingsEditor";
import { DecodedMarker } from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/PointClouds/decodeMarker";
import { PointCloud2, PointField } from "@foxglove/studio-base/types/Messages";

import {
  getVertexValues,
  getVertexValue,
  getFieldOffsetsAndReaders,
  getVertexCount,
} from "./buffers";

type MinMaxColors = { minColorValue: number; maxColorValue: number };

type DecodedFields = { [fieldName: string]: number[] };

function getRange(min: number, max: number): number {
  const delta = max - min;
  return delta !== 0 ? delta : Infinity;
}

// returns the linear interpolation between a and b based on unit-range variable t
function lerp(t: number, a: number, b: number): number {
  if (a === b) {
    return a;
  }
  // Clamp t to (0, 1)
  return a + Math.min(Math.max(t, 0.0), 1.0) * (b - a);
}

export type ClickedInfo = {
  clickedPoint: number[];
  clickedPointColor?: number[];
  additionalFieldValues?: {
    [name: string]: number | undefined;
  };
};

export function toRgba(rgba: Color): [number, number, number, number] {
  return toRGBA({ r: rgba.r * 255, g: rgba.g * 255, b: rgba.b * 255, a: rgba.a });
}

// extract clicked point's position, color and additional field values to display in the UI
export function getClickedInfo(
  maybeFullyDecodedMarker: Omit<DecodedMarker, "data">,
  instanceIndex: number | undefined,
): ClickedInfo | undefined {
  const { positionBuffer, colorBuffer, fields, settings, is_bigendian } = maybeFullyDecodedMarker;
  if (
    isEmpty(positionBuffer) ||
    isNil(instanceIndex) ||
    instanceIndex >= getVertexCount(positionBuffer)
  ) {
    return undefined;
  }

  const pointIndex = instanceIndex ?? 0;

  // Extract [x, y, z] from position buffer;
  const clickedPoint = getVertexValues(positionBuffer, pointIndex, 3);

  let clickedPointColor: number[] = [];
  const colorMode = settings?.colorMode;
  if (colorMode != undefined) {
    if (colorMode.mode === "rgb" && colorBuffer) {
      // Extract [r, g, b, a] from colors buffer
      clickedPointColor = [
        ...getVertexValues(colorBuffer, pointIndex, 3), // alpha value is set to 1 since 'colorBuffer' only stores
        // [r, g, b] components. Shaders always use an alpha value
        // of 1 as well.
        1.0,
      ];
      if (!is_bigendian) {
        // When data uses little endianess, colors are in BGR format
        // and we must swap R and B channels to display them correclty.
        const temp = clickedPointColor[2] as number;
        clickedPointColor[2] = clickedPointColor[0] as number;
        clickedPointColor[0] = temp;
      }
    } else if (colorMode.mode === "gradient" && colorBuffer) {
      const { minColorValue, maxColorValue } = maybeFullyDecodedMarker as MinMaxColors;
      const colorFieldValue = getVertexValue(colorBuffer, pointIndex);
      const colorFieldRange = getRange(minColorValue, maxColorValue);
      const pct = Math.max(0, Math.min((colorFieldValue - minColorValue) / colorFieldRange, 1));
      const { minColor, maxColor } = colorMode;
      const parsedMinColor = toRgba(minColor ?? DEFAULT_MIN_COLOR);
      const parsedMaxColor = toRgba(maxColor ?? DEFAULT_MAX_COLOR);
      clickedPointColor = [
        lerp(pct, parsedMinColor[0], parsedMaxColor[0]), // R
        lerp(pct, parsedMinColor[1], parsedMaxColor[1]), // G
        lerp(pct, parsedMinColor[2], parsedMaxColor[2]), // B
        1.0,
      ];
    } else if (colorMode.mode === "rainbow" && colorBuffer) {
      const { minColorValue, maxColorValue } = maybeFullyDecodedMarker as MinMaxColors;
      const colorFieldValue = getVertexValue(colorBuffer, pointIndex);
      const colorFieldRange = getRange(minColorValue, maxColorValue);
      const pct = Math.max(0, Math.min((colorFieldValue - minColorValue) / colorFieldRange, 1));
      clickedPointColor = [0, 0, 0, 1];
      setRainbowColor(clickedPointColor, 0, pct);
    } else if (colorMode.mode === "flat") {
      clickedPointColor = toRgba(colorMode.flatColor ?? DEFAULT_FLAT_COLOR);
    }
  }

  let additionalFieldValues: { [name: string]: number | undefined } | undefined;
  const additionalField = getAdditionalFieldNames(fields);
  if (additionalField.length > 0) {
    additionalFieldValues = additionalField.reduce((memo, fieldName) => {
      const values = (maybeFullyDecodedMarker as unknown as Record<string, number[]>)[fieldName];
      if (values) {
        memo[fieldName] = values[pointIndex];
      }
      return memo;
    }, {} as { [name: string]: number | undefined });
  }

  return {
    clickedPoint,
    clickedPointColor,
    additionalFieldValues,
  };
}

// Extract positions so they can be saved to a file
export function getAllPoints(maybeFullyDecodedMarker: DecodedMarker): number[] {
  const { pointCount, positionBuffer } = maybeFullyDecodedMarker;
  const ret = [];
  for (let i = 0; i < pointCount; i++) {
    const position = getVertexValues(positionBuffer, i, 3);
    if (!Number.isNaN(position[0])) {
      ret.push(...position);
    }
  }
  return ret;
}

export function getAdditionalFieldNames(fields: readonly PointField[]): string[] {
  const allFields = fields.map((field) => field.name);
  return difference(allFields, ["rgb", "x", "y", "z"]);
}

export function decodeAdditionalFields<T extends PointCloud2>(
  marker: T,
): Omit<T, "data"> & Record<string, unknown> {
  const { fields, data, width, row_step, height, point_step } = marker;
  const offsets = getFieldOffsetsAndReaders(data, fields);

  let pointCount = 0;
  const additionalField = getAdditionalFieldNames(fields);
  const otherFieldsValues = additionalField.reduce((memo, name) => {
    memo[name] = new Array(width * height);
    return memo;
  }, {} as DecodedFields);
  for (let row = 0; row < height; row++) {
    const dataOffset = row * row_step;
    for (let col = 0; col < width; col++) {
      const dataStart = col * point_step + dataOffset;
      for (const fieldName of additionalField) {
        const reader = offsets[fieldName]?.reader;
        if (reader) {
          const fieldValue = reader.read(dataStart);
          otherFieldsValues[fieldName]![pointCount] = fieldValue;
        }
      }
      // increase point count by 1
      pointCount++;
    }
  }

  return {
    ...omit(marker, "data"), // no need to include data since all fields have been decoded
    ...otherFieldsValues,
  };
}

// taken from http://docs.ros.org/jade/api/rviz/html/c++/point__cloud__transformers_8cpp_source.html
// line 47
export function setRainbowColor(colors: Uint8Array | number[], offset: number, pct: number): void {
  const h = (1 - pct) * 5.0 + 1.0;
  const i = Math.floor(h);
  let f = h % 1.0;
  // if i is even
  if ((i & 1) === 0) {
    f = 1 - f;
  }
  const n = 1 - f;
  let r = 0;
  let g = 0;
  let b = 0;
  if (i <= 1) {
    r = n;
    g = 0;
    b = 1;
  } else if (i === 2) {
    r = 0;
    g = n;
    b = 1;
  } else if (i === 3) {
    r = 0;
    g = 1;
    b = n;
  } else if (i === 4) {
    r = n;
    g = 1;
    b = 0;
  } else {
    r = 1;
    g = n;
    b = 0;
  }
  colors[offset] = r * 255;
  colors[offset + 1] = g * 255;
  colors[offset + 2] = b * 255;
}
