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

import {
  ColorMode,
  DEFAULT_RGB_BYTE_ORDER,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/pointCloudColors";
import { PointField } from "@foxglove/studio-base/types/Messages";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

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
  const buffer = new Float32Array(readers.length * pointCount);
  for (let i = 0; i < pointCount; i++) {
    const pointStart = i * stride;
    for (let j = 0; j < readers.length; j++) {
      buffer[i * readers.length + j] = readers[j]?.read(pointStart) ?? Number.NaN;
    }
  }
  return {
    buffer,
    offset: 0,
    stride: readers.length,
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
  if (!xField?.reader) {
    throw new Error(
      `${
        xField ? `Unsupported datatype ${xField.datatype} for` : "Missing"
      } x field in point cloud. Point clouds cannot be displayed without readable x, y, and z fields.`,
    );
  }
  if (!yField?.reader) {
    throw new Error(
      `${
        yField ? `Unsupported datatype ${yField.datatype} for` : "Missing"
      } y field in point cloud. Point clouds cannot be displayed without readable x, y, and z fields.`,
    );
  }
  if (!zField?.reader) {
    throw new Error(
      `${
        zField ? `Unsupported datatype ${zField.datatype} for` : "Missing"
      } z field in point cloud. Point clouds cannot be displayed without readable x, y, and z fields.`,
    );
  }

  // Check if all position components are stored next to each other
  const positionIsValid =
    xField.datatype === DATATYPE.FLOAT32 &&
    yField.datatype === DATATYPE.FLOAT32 &&
    zField.datatype === DATATYPE.FLOAT32 &&
    yField.offset - xField.offset === FLOAT_SIZE &&
    zField.offset - yField.offset === FLOAT_SIZE;
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
  isBigEndian: boolean;
}): VertexBuffer | undefined {
  if (colorMode.mode === "flat") {
    // If color mode is "flat", we don't need a color buffer since
    // we'll be using a constant value
    return undefined;
  }

  if (colorMode.mode === "rgb" || colorMode.mode === "rgba") {
    const rgbField = mightActuallyBePartial(fields[colorMode.mode] ?? fields.rgb ?? fields.rgba);
    if (!rgbField) {
      throw new Error("Cannot create color buffer in rgb mode without an rgb(a) field");
    }
    const rgbOffset = rgbField.offset ?? 0;
    // Extract colors from data
    let aOffset = 0;
    let rOffset = 0;
    let gOffset = 0;
    let bOffset = 0;
    switch (colorMode.rgbByteOrder ?? DEFAULT_RGB_BYTE_ORDER) {
      case "rgba":
        rOffset = 0;
        gOffset = 1;
        bOffset = 2;
        aOffset = 3;
        break;
      case "bgra":
        bOffset = 0;
        gOffset = 1;
        rOffset = 2;
        aOffset = 3;
        break;
      case "abgr":
        aOffset = 0;
        bOffset = 1;
        gOffset = 2;
        rOffset = 3;
        break;
    }
    const readers = [
      new Uint8Reader(data, rgbOffset + rOffset),
      new Uint8Reader(data, rgbOffset + gOffset),
      new Uint8Reader(data, rgbOffset + bOffset),
      colorMode.mode === "rgba" ? new Uint8Reader(data, rgbOffset + aOffset) : { read: () => 255 },
    ];
    return extractValues({ data, readers, stride, pointCount });
  }

  const colorFieldName =
    mightActuallyBePartial(colorMode).colorField ?? (fields.rgba ? "rgba" : "rgb");
  const colorField = fields[colorFieldName];
  if (!colorField) {
    throw new Error(`Cannot create color buffer without ${colorFieldName} field`);
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
