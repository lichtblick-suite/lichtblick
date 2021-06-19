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

import REGL from "regl";

import {
  DEFAULT_FLAT_COLOR,
  ColorMode,
  PointCloudSettings,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PointCloudSettingsEditor";

import {
  getFieldOffsetsAndReaders,
  createPositionBuffer,
  createColorBuffer,
  getVertexCount,
  getVertexValue,
} from "./buffers";
import { PointCloudMarker, VertexBuffer } from "./types";

export type DecodedMarker = PointCloudMarker & {
  depth?: REGL.DepthTestOptions;
  blend?: REGL.BlendingOptions;
  pointCount: number;
  positionBuffer: VertexBuffer;
  colorBuffer?: VertexBuffer;
  minColorValue: number;
  maxColorValue: number;
  settings: PointCloudSettings & {
    colorMode: ColorMode;
  };
};

// Decode a marker and generate position and color buffers for rendering
// The resulting marker should be memoized for better performance
export function decodeMarker(marker: PointCloudMarker): DecodedMarker {
  const {
    fields = [],
    settings = {},
    point_step: stride,
    width,
    height,
    hitmapColors,
    data,
  } = marker;
  const offsetsAndReaders = getFieldOffsetsAndReaders(data, fields);
  const rgbOffset = offsetsAndReaders.rgb?.offset;

  // Calculate the number of points in the cloud.
  // Do not use data.length, since it doesn't work with sparse point clouds.
  const pointCount = width * height;

  const colorMode: ColorMode = settings.colorMode
    ? settings.colorMode
    : rgbOffset != undefined
    ? { mode: "rgb" }
    : { mode: "flat", flatColor: DEFAULT_FLAT_COLOR };

  const isHitmap = !!hitmapColors;

  const positionBuffer = createPositionBuffer({
    data,
    fields: offsetsAndReaders,
    pointCount,
    stride,
  });

  // If hitmapColors are provided, we don't need a colorBuffer
  // This check will also avoid computing min/max values on CPU
  // since they're not needed for hitmap.
  const colorBuffer = isHitmap
    ? undefined
    : createColorBuffer({
        data,
        fields: offsetsAndReaders,
        colorMode,
        pointCount,
        stride,
      });

  let minColorValue: number = Number.POSITIVE_INFINITY;
  let maxColorValue: number = Number.NEGATIVE_INFINITY;

  // For some color modes, we need to compute min/max values for the selected color field
  // Unfortunately, we cannot do this in GPU and we need to traverse the color array to
  // fetch the required values.
  // These calculations can be ignored if we're rendering to the hitmap
  if (colorBuffer && !isHitmap && (colorMode.mode === "gradient" || colorMode.mode === "rainbow")) {
    let hasMinValue = false;
    if (colorMode.minValue != undefined) {
      hasMinValue = true;
      minColorValue = colorMode.minValue;
    }
    let hasMaxValue = false;
    if (colorMode.maxValue != undefined) {
      hasMaxValue = true;
      maxColorValue = colorMode.maxValue;
    }
    // It's possible for colorMode to provide min/max values (which may be different than
    // the actual min/max values in the color buffer).
    if (!hasMinValue || !hasMaxValue) {
      for (let i = 0; i < getVertexCount(colorBuffer); i++) {
        const pos = getVertexValue(positionBuffer, i);
        if (Number.isNaN(pos)) {
          // if the position is NaN then don't count this point
          // this is to support non-dense point clouds
          // https://answers.ros.org/question/234455/pointcloud2-and-pointfield/
          continue;
        }
        const value = getVertexValue(colorBuffer, i);
        if (!Number.isNaN(value)) {
          if (!hasMinValue && value < minColorValue) {
            minColorValue = value;
          }
          if (!hasMaxValue && value > maxColorValue) {
            maxColorValue = value;
          }
        }
      }
    }
  }

  return {
    ...marker,
    // Make sure settings are always available
    settings: {
      ...settings,
      colorMode,
    },
    pointCount,
    positionBuffer,
    colorBuffer,
    minColorValue,
    maxColorValue,
    hitmapColors,
  };
}
