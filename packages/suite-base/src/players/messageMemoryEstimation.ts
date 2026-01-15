// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@lichtblick/log";
import { MessageDefinitionMap } from "@lichtblick/mcap-support/src/types";

import {
  COMPRESSED_POINTER_SIZE,
  OBJECT_BASE_SIZE,
  ARRAY_BASE_SIZE,
  TYPED_ARRAY_BASE_SIZE,
  SMALL_INTEGER_SIZE,
  HEAP_NUMBER_SIZE,
  FIELD_SIZE_BY_PRIMITIVE,
  MAX_NUM_FAST_PROPERTIES,
} from "./constants";

const log = Log.getLogger(__filename);

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
            (field.arrayLength ?? 0)
          : 1;

      const knownFieldSize = knownTypeSizes.get(field.type);
      if (knownFieldSize != undefined) {
        sizeInBytes += count > 0 ? count * knownFieldSize : OBJECT_BASE_SIZE;
        continue;
      }

      if (checkedTypes?.includes(field.type) ?? false) {
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

/**
 * Estimate the size in bytes of an arbitrary object or primitive.
 * @param obj Object or primitive to estimate the size for
 * @returns Estimated size in bytes
 */
export function estimateObjectSize(obj: unknown): number {
  // catches null and undefined
  // typeof null == "object"
  if (obj == undefined) {
    return SMALL_INTEGER_SIZE;
  }

  const estimateArraySize = (array: unknown[]): number =>
    COMPRESSED_POINTER_SIZE +
    ARRAY_BASE_SIZE +
    array.reduce(
      (accumulator: number, value: unknown) => accumulator + estimateObjectSize(value),
      0,
    );

  const estimateMapSize = (map: Map<unknown, unknown>): number =>
    COMPRESSED_POINTER_SIZE +
    OBJECT_BASE_SIZE +
    Array.from(map.entries()).reduce(
      (accumulator: number, [key, value]: [unknown, unknown]) =>
        accumulator + estimateObjectSize(key) + estimateObjectSize(value),
      0,
    );

  const estimateSetSize = (set: Set<unknown>): number =>
    COMPRESSED_POINTER_SIZE +
    OBJECT_BASE_SIZE +
    Array.from(set.values()).reduce(
      (accumulator: number, value: unknown) => accumulator + estimateObjectSize(value),
      0,
    );

  const estimateObjectPropertiesSize = (object: Record<string, unknown>): number => {
    const valuesSize = Object.values(object).reduce(
      (accumulator: number, value: unknown) => accumulator + estimateObjectSize(value),
      0,
    );
    const numProps = Object.keys(obj).length;

    if (numProps > MAX_NUM_FAST_PROPERTIES) {
      // If there are too many properties, V8 stores Objects in dictionary mode (slow properties)
      // with each object having a self-contained dictionary. This dictionary contains the key, value
      // and details of properties. Below we estimate the size of this additional dictionary. Formula
      // adapted from medium.com/@bpmxmqd/v8-engine-jsobject-structure-analysis-and-memory-optimization-ideas-be30cfcdcd16
      const propertiesDictSize =
        16 + 5 * 8 + 2 ** Math.ceil(Math.log2((numProps + 2) * 1.5)) * 3 * 4;
      return (
        OBJECT_BASE_SIZE + valuesSize + propertiesDictSize - numProps * COMPRESSED_POINTER_SIZE
      );
    }

    return OBJECT_BASE_SIZE + valuesSize;
  };

  switch (typeof obj) {
    case "undefined":
    case "boolean":
      return SMALL_INTEGER_SIZE;

    case "number":
      return Number.isInteger(obj) ? SMALL_INTEGER_SIZE : HEAP_NUMBER_SIZE;

    case "bigint":
      return HEAP_NUMBER_SIZE;

    case "string":
      return COMPRESSED_POINTER_SIZE + OBJECT_BASE_SIZE + Math.ceil(obj.length / 4) * 4;

    case "object":
      if (Array.isArray(obj)) {
        return estimateArraySize(obj);
      }
      if (ArrayBuffer.isView(obj)) {
        return TYPED_ARRAY_BASE_SIZE + obj.byteLength;
      }
      if (obj instanceof Set) {
        return estimateSetSize(obj);
      }
      if (obj instanceof Map) {
        return estimateMapSize(obj);
      }
      return estimateObjectPropertiesSize(obj as Record<string, unknown>);

    case "symbol":
    case "function":
      throw new Error(`Can't estimate size of type '${typeof obj}'`);
  }

  log.error(`Can't estimate size of type '${typeof obj}'`);
  return SMALL_INTEGER_SIZE;
}
