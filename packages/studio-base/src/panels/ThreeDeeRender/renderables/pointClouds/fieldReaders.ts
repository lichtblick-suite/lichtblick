// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { NumericType, PackedElementField } from "@foxglove/schemas";

import { PointField, PointFieldType } from "../../ros";

export type FieldReader = (view: DataView, pointOffset: number) => number;

export function int8Reader(fieldOffset: number): FieldReader {
  return (view: DataView, pointOffset: number) => view.getInt8(pointOffset + fieldOffset);
}

export function uint8Reader(fieldOffset: number): FieldReader {
  return (view: DataView, pointOffset: number) => view.getUint8(pointOffset + fieldOffset);
}

export function int16Reader(fieldOffset: number): FieldReader {
  return (view: DataView, pointOffset: number) => view.getInt16(pointOffset + fieldOffset, true);
}

export function uint16Reader(fieldOffset: number): FieldReader {
  return (view: DataView, pointOffset: number) => view.getUint16(pointOffset + fieldOffset, true);
}

export function int32Reader(fieldOffset: number): FieldReader {
  return (view: DataView, pointOffset: number) => view.getInt32(pointOffset + fieldOffset, true);
}

export function uint32Reader(fieldOffset: number): FieldReader {
  return (view: DataView, pointOffset: number) => view.getUint32(pointOffset + fieldOffset, true);
}

export function float32Reader(fieldOffset: number): FieldReader {
  return (view: DataView, pointOffset: number) => view.getFloat32(pointOffset + fieldOffset, true);
}

export function float64Reader(fieldOffset: number): FieldReader {
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
        return field.offset + 1 <= stride ? int8Reader(field.offset) : undefined;
      case PointFieldType.UINT8:
        return field.offset + 1 <= stride ? uint8Reader(field.offset) : undefined;
      case PointFieldType.INT16:
        return field.offset + 2 <= stride ? int16Reader(field.offset) : undefined;
      case PointFieldType.UINT16:
        return field.offset + 2 <= stride ? uint16Reader(field.offset) : undefined;
      case PointFieldType.INT32:
        return field.offset + 4 <= stride ? int32Reader(field.offset) : undefined;
      case PointFieldType.UINT32:
        return field.offset + 4 <= stride ? uint32Reader(field.offset) : undefined;
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
        return field.offset + 1 <= stride ? int8Reader(field.offset) : undefined;
      case NumericType.UINT8:
        return field.offset + 1 <= stride ? uint8Reader(field.offset) : undefined;
      case NumericType.INT16:
        return field.offset + 2 <= stride ? int16Reader(field.offset) : undefined;
      case NumericType.UINT16:
        return field.offset + 2 <= stride ? uint16Reader(field.offset) : undefined;
      case NumericType.INT32:
        return field.offset + 4 <= stride ? int32Reader(field.offset) : undefined;
      case NumericType.UINT32:
        return field.offset + 4 <= stride ? uint32Reader(field.offset) : undefined;
      case NumericType.FLOAT32:
        return field.offset + 4 <= stride ? float32Reader(field.offset) : undefined;
      case NumericType.FLOAT64:
        return field.offset + 8 <= stride ? float64Reader(field.offset) : undefined;
      default:
        return undefined;
    }
  }
}
