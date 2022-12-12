// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ByteBuffer } from "flatbuffers";
import { BaseType, Schema, SchemaT, FieldT, Parser, Table } from "flatbuffers_reflection";

import { RosMsgField } from "@foxglove/rosmsg";

import { RosDatatypes } from "./types";

function typeForSimpleField(type: BaseType): string {
  switch (type) {
    case BaseType.Bool:
      return "bool";
    case BaseType.Byte:
      return "int8";
    case BaseType.UType:
    case BaseType.UByte:
      return "uint8";
    case BaseType.Short:
      return "int16";
    case BaseType.UShort:
      return "uint16";
    case BaseType.Int:
      return "int32";
    case BaseType.UInt:
      return "uint32";
    case BaseType.Long:
      return "int64";
    case BaseType.ULong:
      return "uint64";
    case BaseType.Float:
      return "float32";
    case BaseType.Double:
      return "float64";
    case BaseType.String:
      return "string";
    case BaseType.Vector:
    case BaseType.Obj:
    case BaseType.Union:
    case BaseType.Array:
      throw new Error(`${type} is not a simple type.`);
    case BaseType.None:
    case BaseType.MaxBaseType:
      throw new Error("None is not a valid type.");
  }
}

// eslint-disable-next-line no-restricted-syntax
function flatbufferString(unchecked: string | Uint8Array | null | undefined): string {
  if (typeof unchecked === "string") {
    return unchecked;
  }
  throw new Error(`Expected string, found ${typeof unchecked}`);
}

function typeForField(schema: SchemaT, field: FieldT): RosMsgField[] {
  const fields: RosMsgField[] = [];
  switch (field.type?.baseType) {
    case BaseType.UType:
    case BaseType.Bool:
    case BaseType.Byte:
    case BaseType.UByte:
    case BaseType.Short:
    case BaseType.UShort:
    case BaseType.Int:
    case BaseType.UInt:
    case BaseType.Long:
    case BaseType.ULong:
    case BaseType.Float:
    case BaseType.Double:
    case BaseType.String:
    case BaseType.None: {
      const simpleType = typeForSimpleField(field.type.baseType);
      // Enums have magic logic--the constants definitions for the enum values
      // have to go right before the enum itself.
      if (field.type.index !== -1) {
        const enums = schema.enums[field.type.index]?.values;
        if (enums == undefined) {
          throw new Error(
            `Invalid schema, missing enum values for field type ${
              schema.enums[field.type.index]?.name
            }`,
          );
        }
        for (const enumVal of enums) {
          fields.push({
            name: flatbufferString(enumVal.name),
            type: simpleType,
            isConstant: true,
            value: enumVal.value,
          });
        }
      }
      fields.push({ name: flatbufferString(field.name), type: simpleType });
      break;
    }
    case BaseType.Vector:
      switch (field.type.element) {
        case BaseType.Vector:
        case BaseType.Union:
        case BaseType.Array:
        case BaseType.None:
          throw new Error("Vectors of vectors, unions, arrays, and None's are unsupported.");
        case BaseType.Obj:
          fields.push({
            name: flatbufferString(field.name),
            type: flatbufferString(schema.objects[field.type.index]?.name),
            isComplex: true,
            isArray: true,
          });
          break;
        default: {
          const type = typeForSimpleField(field.type.element);
          // Enums have magic logic--the constants definitions for the enum
          // values have to go right before the enum itself.
          if (field.type.index !== -1) {
            const enums = schema.enums[field.type.index]?.values;
            if (enums == undefined) {
              throw new Error("Invalid schema");
            }
            for (const enumVal of enums) {
              fields.push({
                name: flatbufferString(enumVal.name),
                type,
                isConstant: true,
                value: enumVal.value,
              });
            }
          }
          fields.push({ name: flatbufferString(field.name), type, isArray: true });
          break;
        }
      }
      break;
    case BaseType.Obj:
      fields.push({
        name: flatbufferString(field.name),
        type: flatbufferString(schema.objects[field.type.index]?.name),
        isComplex: true,
      });
      break;
    case BaseType.Union:
    case BaseType.Array:
    case BaseType.MaxBaseType:
    case undefined:
      throw new Error("Unions and Arrays are not supported in mcap-support currently.");
  }
  return fields;
}

// Note: Currently this does not support "lazy" message reading in the style of the ros1 message
// reader, and so will relatively inefficiently deserialize the entire flatbuffer message.
export function parseFlatbufferSchema(
  schemaName: string,
  schemaArray: Uint8Array,
): {
  datatypes: RosDatatypes;
  deserializer: (buffer: ArrayBufferView) => unknown;
} {
  const datatypes: RosDatatypes = new Map();
  const schemaBuffer = new ByteBuffer(schemaArray);
  const rawSchema = Schema.getRootAsSchema(schemaBuffer);
  const schema = rawSchema.unpack();

  let typeIndex = -1;
  for (let schemaIndex = 0; schemaIndex < schema.objects.length; ++schemaIndex) {
    const object = schema.objects[schemaIndex];
    if (object?.name === schemaName) {
      typeIndex = schemaIndex;
    }
    let fields: RosMsgField[] = [];
    if (object?.fields == undefined) {
      continue;
    }
    for (const field of object.fields) {
      fields = fields.concat(typeForField(schema, field));
    }
    datatypes.set(flatbufferString(object.name), { definitions: fields });
  }
  if (typeIndex === -1) {
    if (schema.rootTable?.name !== schemaName) {
      throw new Error(
        `Type "${schemaName}" is not available in the schema for "${schema.rootTable?.name}".`,
      );
    }
  }
  const parser = new Parser(rawSchema);
  const deserializer = (buffer: ArrayBufferView) => {
    const byteBuffer = new ByteBuffer(
      new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
    );
    const table = new Table(
      byteBuffer,
      typeIndex,
      byteBuffer.readInt32(byteBuffer.position()) + byteBuffer.position(),
    );
    const obj = parser.toObject(table);
    return obj;
  };
  return { datatypes, deserializer };
}
