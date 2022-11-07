// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { NumericType, PackedElementField } from "@foxglove/schemas";

import { PointField, PointFieldType } from "../../ros";

export type FieldReader = (view: DataView, pointOffset: number) => number;

// eslint-disable-next-line @foxglove/no-boolean-parameters
function int8Reader(fieldOffset: number, normalize: boolean): FieldReader {
  return (view: DataView, pointOffset: number) => {
    const value = view.getInt8(pointOffset + fieldOffset);
    if (normalize) {
      return Math.max(value / 0x7f, -1);
    }
    return value;
  };
}

// eslint-disable-next-line @foxglove/no-boolean-parameters
function uint8Reader(fieldOffset: number, normalize: boolean): FieldReader {
  return (view: DataView, pointOffset: number) => {
    const value = view.getUint8(pointOffset + fieldOffset);
    if (normalize) {
      return value / 0xff;
    }
    return value;
  };
}

// eslint-disable-next-line @foxglove/no-boolean-parameters
function int16Reader(fieldOffset: number, normalize: boolean): FieldReader {
  return (view: DataView, pointOffset: number) => {
    const value = view.getInt16(pointOffset + fieldOffset, true);
    if (normalize) {
      return Math.max(value / 0x7fff, -1);
    }
    return value;
  };
}

// eslint-disable-next-line @foxglove/no-boolean-parameters
function uint16Reader(fieldOffset: number, normalize: boolean): FieldReader {
  return (view: DataView, pointOffset: number) => {
    const value = view.getUint16(pointOffset + fieldOffset, true);
    if (normalize) {
      return value / 0xffff;
    }
    return value;
  };
}

// eslint-disable-next-line @foxglove/no-boolean-parameters
function int32Reader(fieldOffset: number, normalize: boolean): FieldReader {
  return (view: DataView, pointOffset: number) => {
    const value = view.getInt32(pointOffset + fieldOffset, true);
    if (normalize) {
      return Math.max(value / 0x7fffffff, -1);
    }
    return value;
  };
}

// eslint-disable-next-line @foxglove/no-boolean-parameters
function uint32Reader(fieldOffset: number, normalize: boolean): FieldReader {
  return (view: DataView, pointOffset: number) => {
    const value = view.getUint32(pointOffset + fieldOffset, true);
    if (normalize) {
      return value / 0xffffffff;
    }
    return value;
  };
}

function float32Reader(fieldOffset: number): FieldReader {
  return (view: DataView, pointOffset: number) => view.getFloat32(pointOffset + fieldOffset, true);
}

function float64Reader(fieldOffset: number): FieldReader {
  return (view: DataView, pointOffset: number) => view.getFloat64(pointOffset + fieldOffset, true);
}

export function isSupportedField(field: PackedElementField | PointField): boolean {
  // Only PointFields with count === 1 are supported (doesn't apply to PackedElementFields)
  if ("count" in field && field.count !== 1) {
    return false;
  }
  return true;
}

export function getReader(
  field: PackedElementField | PointField,
  stride: number,
  /** @see https://www.khronos.org/opengl/wiki/Normalized_Integer */
  // Performance-sensitive: this code is called for every point cloud message
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  normalize = false,
  forceType?: PointFieldType | NumericType,
): FieldReader | undefined {
  if (!isSupportedField(field)) {
    return undefined;
  }

  const numericType = (field as Partial<PackedElementField>).type;
  if (numericType == undefined) {
    const type = forceType ?? (field as PointField).datatype;
    switch (type) {
      case PointFieldType.INT8:
        return field.offset + 1 <= stride ? int8Reader(field.offset, normalize) : undefined;
      case PointFieldType.UINT8:
        return field.offset + 1 <= stride ? uint8Reader(field.offset, normalize) : undefined;
      case PointFieldType.INT16:
        return field.offset + 2 <= stride ? int16Reader(field.offset, normalize) : undefined;
      case PointFieldType.UINT16:
        return field.offset + 2 <= stride ? uint16Reader(field.offset, normalize) : undefined;
      case PointFieldType.INT32:
        return field.offset + 4 <= stride ? int32Reader(field.offset, normalize) : undefined;
      case PointFieldType.UINT32:
        return field.offset + 4 <= stride ? uint32Reader(field.offset, normalize) : undefined;
      case PointFieldType.FLOAT32:
        return field.offset + 4 <= stride ? float32Reader(field.offset) : undefined;
      case PointFieldType.FLOAT64:
        return field.offset + 8 <= stride ? float64Reader(field.offset) : undefined;
      default:
        return undefined;
    }
  } else {
    const type = (forceType ?? numericType) as NumericType;
    switch (type) {
      case NumericType.INT8:
        return field.offset + 1 <= stride ? int8Reader(field.offset, normalize) : undefined;
      case NumericType.UINT8:
        return field.offset + 1 <= stride ? uint8Reader(field.offset, normalize) : undefined;
      case NumericType.INT16:
        return field.offset + 2 <= stride ? int16Reader(field.offset, normalize) : undefined;
      case NumericType.UINT16:
        return field.offset + 2 <= stride ? uint16Reader(field.offset, normalize) : undefined;
      case NumericType.INT32:
        return field.offset + 4 <= stride ? int32Reader(field.offset, normalize) : undefined;
      case NumericType.UINT32:
        return field.offset + 4 <= stride ? uint32Reader(field.offset, normalize) : undefined;
      case NumericType.FLOAT32:
        return field.offset + 4 <= stride ? float32Reader(field.offset) : undefined;
      case NumericType.FLOAT64:
        return field.offset + 8 <= stride ? float64Reader(field.offset) : undefined;
      default:
        return undefined;
    }
  }
}
