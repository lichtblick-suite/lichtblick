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

import { ColorMode } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PointCloudSettingsEditor";
import { PointField } from "@foxglove/studio-base/types/Messages";

import { FieldReader, Uint8Reader, getReader } from "./readers";
import { DATATYPE, VertexBuffer } from "./types";

export type FieldOffsetsAndReaders = {
  [name: string]: { datatype: number; offset: number; reader?: FieldReader };
};

export function getFieldOffsetsAndReaders(
  data: Uint8Array,
  fields: readonly PointField[],
): FieldOffsetsAndReaders {
  const result: FieldOffsetsAndReaders = {};
  for (const { name, datatype, offset = 0 } of fields) {
    result[name] = {
      datatype,
      offset,
      reader: getReader(data, datatype, offset),
    };
  }
  return result;
}

export const FLOAT_SIZE = Float32Array.BYTES_PER_ELEMENT;

// Reinterpret a buffer of bytes as a buffer of float values
export function reinterpretBufferToFloat(buffer: Uint8Array): Float32Array {
  if (buffer.byteOffset % FLOAT_SIZE === 0) {
    // Fast path when byteOffset is aligned with FLOAT_SIZE
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / FLOAT_SIZE);
  } else {
    // Bad alignment, we have to copy a section of the ArrayBuffer
    const end = buffer.byteOffset + buffer.length;
    return new Float32Array(buffer.buffer.slice(buffer.byteOffset, end));
  }
}

// Expand a buffer of byte values, transforming each value into a float
export function expandBufferToFloat(buffer: Uint8Array): Float32Array {
  return new Float32Array(buffer);
}

// Utility function to get values from vertex buffers.
// Since data is stored as floats, we need to divide both offset and stride
// to get the actual values within the buffer
export function getVertexValue(buffer: VertexBuffer, index: number): number {
  const data = buffer.buffer;
  const offset = buffer.offset;
  const stride = buffer.stride;
  return data[index * stride + offset]!;
}

// Utility function to get multiple consecutive values from vertex buffers.
export function getVertexValues(buffer: VertexBuffer, index: number, count: number): number[] {
  const ret = [];
  const data = buffer.buffer;
  const offset = buffer.offset;
  const stride = buffer.stride;
  for (let i = 0; i < count; i++) {
    ret.push(data[index * stride + offset + i]!);
  }
  return ret;
}

// The number of points in a buffer is equal to the length of the buffer
// divided by the number of float values in each vertex
export function getVertexCount(buffer: VertexBuffer): number {
  return buffer.buffer.length / buffer.stride;
}

// Utility function to check if the size of each vertex in a buffer is
// supported by WebGL 1.0. The maximum stride size is 255 bytes.
// Also, stride must be a multiple of sizeof(float) in order for us
// to reinterpret the data buffer
function hasValidStride(stride: number): boolean {
  return stride <= 255 && stride % FLOAT_SIZE === 0;
}

// This is a fallback function to extract values from data buffers
// It's used on some cases where we cannot send the data as is to the GPU,
// either because we ended up with an unsupported vertex size (see hasValidStride())
// or because the color field has a datatype that is not easy to work with in shaders
// This function always returns a Float32Array with three values for each point
// in the cloud since it might be used for both colors and/or positions.
function extractValues({
  readers,
  pointCount,
  stride,
}: {
  data: Uint8Array;
  readers: (FieldReader | undefined)[];
  pointCount: number;
  stride: number;
}): VertexBuffer {
  const COMPONENT_COUNT = 3;
  const buffer = new Float32Array(COMPONENT_COUNT * pointCount);
  for (let i = 0; i < pointCount; i++) {
    const pointStart = i * stride;
    for (let j = 0; j < readers.length; j++) {
      const reader = readers[j];
      let value = Number.NaN;
      if (reader != undefined) {
        value = reader.read(pointStart);
      }
      buffer[i * COMPONENT_COUNT + j] = value;
    }
  }
  return {
    buffer,
    offset: 0,
    stride: COMPONENT_COUNT,
  };
}

export function createPositionBuffer({
  data,
  fields,
  pointCount,
  stride,
}: {
  data: Uint8Array;
  fields: FieldOffsetsAndReaders;
  pointCount: number;
  stride: number;
}): VertexBuffer {
  const { x: xField, y: yField, z: zField } = fields;
  if (!xField || !yField || !zField) {
    throw new Error("Cannot create a position buffer without x, y, and z fields");
  }

  // Check if all position components are stored next to each other
  const positionIsValid =
    yField.offset - xField.offset === FLOAT_SIZE && zField.offset - yField.offset === FLOAT_SIZE;
  if (positionIsValid && hasValidStride(stride)) {
    // Create a VBO for positions by recasting the data array into a float array
    // This will give us the correct values for (x,y,z) tuples.
    // This way we don't need to traverse the array in order to get the [x, y, z] values
    // We're paying a memory cost in order to achieve the best performance.
    return {
      buffer: reinterpretBufferToFloat(data),
      // Divide by sizeof(float) since offset and stride are defined based on number of
      // float values, not bytes
      offset: xField.offset / FLOAT_SIZE,
      stride: stride / FLOAT_SIZE,
    };
  }

  // We cannot use positions as is from data buffer. Extract them.
  return extractValues({
    data,
    readers: [xField.reader, yField.reader, zField.reader],
    pointCount,
    stride,
  });
}

export function createColorBuffer({
  data,
  fields,
  colorMode,
  pointCount,
  stride,
}: {
  data: Uint8Array;
  fields: FieldOffsetsAndReaders;
  colorMode: ColorMode;
  pointCount: number;
  stride: number;
}): VertexBuffer | undefined {
  if (colorMode.mode === "flat") {
    // If color mode is "flat", we don't need a color buffer since
    // we'll be using a constant value
    return undefined;
  }

  if (colorMode.mode === "rgb") {
    const rgbField = fields.rgb;
    if (!rgbField) {
      throw new Error("Cannot create color buffer in rgb mode without an rgb field");
    }
    const rgbOffset = rgbField.offset ?? 0;
    if (hasValidStride(FLOAT_SIZE * stride)) {
      return {
        // RGB colors are encoded in a single 4-byte tuple and unfortunately we cannot extract
        // them in shaders by just reinterpreting the data buffer.
        // In addition, the supported WebGL implementation constraints VBOs to be of type float,
        // so we cannot send the data as is. Then, we're converting the data array into a float
        // array, transforming each byte value into a float.
        // We're definitely paying a memory cost here
        buffer: expandBufferToFloat(data),
        // No need to divide/multiply by sizeof(float) here since now every byte value
        // in data array is transformed to a float value.
        offset: rgbOffset, //< float values from the start of each vertex
        stride, //< float values between vertices
      };
    }
    // stride is too big. Extract colors from data
    return extractValues({
      data,
      readers: [
        new Uint8Reader(data, rgbOffset + 0),
        new Uint8Reader(data, rgbOffset + 1),
        new Uint8Reader(data, rgbOffset + 2),
      ],
      stride,
      pointCount,
    });
  }

  const colorField = fields[colorMode.colorField ?? "rgb"];
  if (!colorField) {
    throw new Error(`Cannot create color buffer without ${colorMode.colorField ?? "rgb"} field`);
  }

  // If the color is computed from any of the other float fields (i.e. x positions)
  // we can do the same trick as for positions, with just a different offset
  // based on the selected color field. We also need to make sure the offset
  // memory alignment is correct (that is, it's divisible by sizeof(float)). There
  // might be other values previous to this one that have different memory alignments.
  if (
    colorField.datatype === DATATYPE.FLOAT32 &&
    colorField.offset % FLOAT_SIZE === 0 &&
    hasValidStride(stride)
  ) {
    return {
      buffer: reinterpretBufferToFloat(data),
      // Divide by sizeof(float) since offset and stride are defined based on number of
      // float values, not bytes
      offset: colorField.offset / FLOAT_SIZE, //< float values from the start of each vertex
      stride: stride / FLOAT_SIZE, //< float values between vertices
    };
  }

  // Color datatype is not float or stride is too big
  // Just extract color data from buffer using CPU
  return extractValues({
    data,
    readers: [colorField.reader],
    stride,
    pointCount,
  });
}
