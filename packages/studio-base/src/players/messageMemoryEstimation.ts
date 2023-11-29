// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageDefinitionMap } from "@foxglove/mcap-support/src/types";

/**
 * Values of the contants below are a (more or less) informed guesses and not guaranteed to be accurate.
 */
const COMPRESSED_POINTER_SIZE = 4; // Pointers use 4 bytes (also on 64-bit systems) due to pointer compression
export const OBJECT_BASE_SIZE = 3 * COMPRESSED_POINTER_SIZE; // 3 compressed pointers
const TYPED_ARRAY_BASE_SIZE = 25 * COMPRESSED_POINTER_SIZE; // byteLength, byteOffset, ..., see https://stackoverflow.com/a/45808835
const SMALL_INTEGER_SIZE = COMPRESSED_POINTER_SIZE; // Small integers (up to 31 bits), pointer tagging
const HEAP_NUMBER_SIZE = 8 + 2 * COMPRESSED_POINTER_SIZE; // 4-byte map pointer + 8-byte payload + property pointer
const FIELD_SIZE_BY_PRIMITIVE: Record<string, number> = {
  bool: SMALL_INTEGER_SIZE,
  int8: SMALL_INTEGER_SIZE,
  uint8: SMALL_INTEGER_SIZE,
  int16: SMALL_INTEGER_SIZE,
  uint16: SMALL_INTEGER_SIZE,
  int32: SMALL_INTEGER_SIZE,
  uint32: SMALL_INTEGER_SIZE,
  float32: HEAP_NUMBER_SIZE,
  float64: HEAP_NUMBER_SIZE,
  int64: HEAP_NUMBER_SIZE,
  uint64: HEAP_NUMBER_SIZE,
  time: OBJECT_BASE_SIZE + 2 * HEAP_NUMBER_SIZE + COMPRESSED_POINTER_SIZE,
  duration: OBJECT_BASE_SIZE + 2 * HEAP_NUMBER_SIZE + COMPRESSED_POINTER_SIZE,
  string: 20, // we don't know the length upfront, assume a fixed length
};
const MAX_NUM_FAST_PROPERTIES = 1020;

/**
 * Estimates the memory size of a deserialized message object based on the schema definition.
 *
 * The estimation is by no means accurate but may in certain situations (especially when there are
 * no dynamic fields such as arrays or strings) give a better estimation than the number of bytes
 * of the serialized message. For estimating memory size, we assume a V8 JS engine (probably
 * similar for other engines).
 *
 * @param datatypes Map of data types
 * @param typeName Name of the data type
 * @param knownTypeSizes Map of known type sizes (for caching purposes)
 * @returns Estimated object size in bytes
 */
export function estimateMessageObjectSize(
  datatypes: MessageDefinitionMap,
  typeName: string,
  knownTypeSizes: Map<string, number>,
  checkedTypes?: string[],
): number {
  const knownSize = knownTypeSizes.get(typeName);
  if (knownSize != undefined) {
    return knownSize;
  }

  if (datatypes.size === 0) {
    return OBJECT_BASE_SIZE; // Empty schema -> Empty object.
  }

  const definition = datatypes.get(typeName);
  if (!definition) {
    throw new Error(`Type '${typeName}' not found in definitions`);
  }

  let sizeInBytes = OBJECT_BASE_SIZE;

  const nonConstantFields = definition.definitions.filter((field) => !(field.isConstant ?? false));
  if (nonConstantFields.length > MAX_NUM_FAST_PROPERTIES) {
    // If there are too many properties, V8 stores Objects in dictionary mode (slow properties)
    // with each object having a self-contained dictionary. This dictionary contains the key, value
    // and details of properties. Below we estimate the size of this additional dictionary. Formula
    // adapted from
    // medium.com/@bpmxmqd/v8-engine-jsobject-structure-analysis-and-memory-optimization-ideas-be30cfcdcd16
    const propertiesDictSize =
      16 + 5 * 8 + 2 ** Math.ceil(Math.log2((nonConstantFields.length + 2) * 1.5)) * 3 * 4;
    sizeInBytes += propertiesDictSize;

    // In return, properties are no longer stored in the properties array
    sizeInBytes -= COMPRESSED_POINTER_SIZE * nonConstantFields.length;
  }

  for (const field of nonConstantFields) {
    if (field.isComplex ?? false) {
      const count =
        field.isArray === true
          ? // We are conservative and assume an empty array to avoid memory overestimation.
            field.arrayLength ?? 0
          : 1;

      const knownFieldSize = knownTypeSizes.get(field.type);
      if (knownFieldSize != undefined) {
        sizeInBytes += count > 0 ? count * knownFieldSize : OBJECT_BASE_SIZE;
        continue;
      }

      if (checkedTypes != undefined && checkedTypes.includes(field.type)) {
        // E.g. protobuf allows types to reference itself.
        // For that reason we bail out here to avoid an infinite loop.
        continue;
      }

      const complexTypeObjectSize = estimateMessageObjectSize(
        datatypes,
        field.type,
        knownTypeSizes,
        (checkedTypes ?? []).concat(field.type),
      );
      sizeInBytes += count > 0 ? count * complexTypeObjectSize : OBJECT_BASE_SIZE;
    } else if (field.isArray === true) {
      // We are conservative and assume an empty array to avoid memory overestimation.
      // For dynamic messages it is better to use another estimator such as the serialized
      // message size.
      const arrayLength = field.arrayLength ?? 0;
      switch (field.type) {
        // Assume that fields get deserialized as typed arrays
        case "int8":
        case "uint8":
          sizeInBytes += TYPED_ARRAY_BASE_SIZE + arrayLength * 1;
          break;
        case "int16":
        case "uint16":
          sizeInBytes += TYPED_ARRAY_BASE_SIZE + arrayLength * 2;
          break;
        case "int32":
        case "uint32":
        case "float32":
          sizeInBytes += TYPED_ARRAY_BASE_SIZE + arrayLength * 4;
          break;
        case "float64":
        case "int64":
        case "uint64":
          sizeInBytes += TYPED_ARRAY_BASE_SIZE + arrayLength * 8;
          break;
        default:
          {
            const primitiveSize = FIELD_SIZE_BY_PRIMITIVE[field.type];
            if (primitiveSize == undefined) {
              throw new Error(`Unknown primitive type ${field.type}`);
            }
            // Assume Array<type> deserialization
            sizeInBytes += arrayLength * primitiveSize + OBJECT_BASE_SIZE + COMPRESSED_POINTER_SIZE;
          }
          break;
      }
    } else {
      const primitiveSize = FIELD_SIZE_BY_PRIMITIVE[field.type];
      if (primitiveSize == undefined) {
        throw new Error(`Unknown primitive type ${field.type}`);
      }
      sizeInBytes += primitiveSize;
    }
  }

  knownTypeSizes.set(typeName, sizeInBytes);

  return sizeInBytes;
}

/**
 * Determine the size of each schema sub-field. This can be used for estimating
 * the size of sliced messages.
 *
 * @param datatypes
 * @param typeName
 * @param knownTypeSizes
 * @returns
 */
export function estimateMessageFieldSizes(
  datatypes: MessageDefinitionMap,
  typeName: string,
  knownTypeSizes: Map<string, number>,
): Record<string, number> {
  const sizeByField: Record<string, number> = {};
  datatypes.get(typeName)?.definitions.forEach((field) => {
    const fieldSchemaName = `${typeName}-${field.name}`;
    const fieldSizeInBytes = estimateMessageObjectSize(
      new Map([[fieldSchemaName, { name: fieldSchemaName, definitions: [field] }], ...datatypes]),
      fieldSchemaName,
      knownTypeSizes,
    );

    // Subtract the object base size here, it will be added only once per sliced message object.
    sizeByField[field.name] = fieldSizeInBytes - OBJECT_BASE_SIZE;
  });

  return sizeByField;
}
