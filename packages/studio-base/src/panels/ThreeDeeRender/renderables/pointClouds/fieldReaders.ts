// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { PackedElementField } from "@foxglove/schemas";

import { numericTypeToPointFieldType } from "../../normalizeMessages";
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

export function getReader(
  field: PackedElementField | PointField,
  pointStep: number,
  forceType?: PointFieldType,
): FieldReader | undefined {
  const numericType = (field as Partial<PackedElementField>).type;
  const type =
    forceType ??
    (numericType != undefined
      ? numericTypeToPointFieldType(numericType)
      : (field as PointField).datatype);
  switch (type) {
    case PointFieldType.INT8:
      return field.offset + 1 <= pointStep ? int8Reader(field.offset) : undefined;
    case PointFieldType.UINT8:
      return field.offset + 1 <= pointStep ? uint8Reader(field.offset) : undefined;
    case PointFieldType.INT16:
      return field.offset + 2 <= pointStep ? int16Reader(field.offset) : undefined;
    case PointFieldType.UINT16:
      return field.offset + 2 <= pointStep ? uint16Reader(field.offset) : undefined;
    case PointFieldType.INT32:
      return field.offset + 4 <= pointStep ? int32Reader(field.offset) : undefined;
    case PointFieldType.UINT32:
      return field.offset + 4 <= pointStep ? uint32Reader(field.offset) : undefined;
    case PointFieldType.FLOAT32:
      return field.offset + 4 <= pointStep ? float32Reader(field.offset) : undefined;
    case PointFieldType.FLOAT64:
      return field.offset + 8 <= pointStep ? float64Reader(field.offset) : undefined;
    default:
      return undefined;
  }
}
