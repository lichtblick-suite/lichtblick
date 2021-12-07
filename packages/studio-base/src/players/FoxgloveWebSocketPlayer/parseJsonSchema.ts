// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as protobufjs from "protobufjs";

import { RosMsgField } from "@foxglove/rosmsg";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

export default function parseJsonSchema(
  rootJsonSchema: Record<string, unknown>,
  rootTypeName: string,
): {
  datatypes: RosDatatypes;

  /**
   * A function that should be called after parsing a value from a JSON string to do any necessary
   * post-processing (e.g. base64 decoding)
   */
  postprocessValue: (value: Record<string, unknown>) => unknown;
} {
  const datatypes: RosDatatypes = new Map();

  function addFieldsRecursive(
    schema: Record<string, unknown>,
    typeName: string,
    keyPath: string[],
  ): (value: Record<string, unknown>) => unknown {
    let postprocessObject: (value: Record<string, unknown>) => unknown = (value) => value;
    const fields: RosMsgField[] = [];
    if (schema.type !== "object") {
      throw new Error(
        `Expected "type": "object" for schema ${typeName}, got ${JSON.stringify(schema.type)}`,
      );
    }
    for (const [fieldName, fieldSchema] of Object.entries(
      schema.properties as Record<string, Record<string, unknown>>,
    )) {
      switch (fieldSchema.type) {
        case "boolean":
          fields.push({ name: fieldName, type: "bool" });
          break;
        case "string":
          switch (fieldSchema.contentEncoding) {
            case undefined:
              fields.push({ name: fieldName, type: "string" });
              break;
            case "base64": {
              fields.push({ name: fieldName, type: "uint8", isArray: true });
              const prevPostprocess = postprocessObject;
              postprocessObject = (value) => {
                const str = value[fieldName];
                if (typeof str === "string") {
                  const decoded = new Uint8Array(protobufjs.util.base64.length(str));
                  if (protobufjs.util.base64.decode(str, decoded, 0) !== decoded.byteLength) {
                    throw new Error(
                      `Failed to decode base64 data for ${keyPath.join(".")}.${fieldName}`,
                    );
                  }
                  value[fieldName] = decoded;
                }
                return prevPostprocess(value);
              };
              break;
            }
            default:
              throw new Error(
                `Unsupported contentEncoding ${JSON.stringify(fieldSchema.contentEncoding)}`,
              );
          }
          break;
        case "number":
        case "integer":
          fields.push({ name: fieldName, type: "float64" });
          break;
        case "object": {
          const nestedTypeName = `${typeName}.${fieldName}`;
          const postprocessNestedObject = addFieldsRecursive(
            fieldSchema,
            nestedTypeName,
            keyPath.concat(fieldName),
          );
          const prevPostprocess = postprocessObject;
          postprocessObject = (value) => {
            value[fieldName] = postprocessNestedObject(value[fieldName] as Record<string, unknown>);
            return prevPostprocess(value);
          };
          fields.push({ name: fieldName, type: nestedTypeName, isComplex: true });
          break;
        }
        case "array": {
          const itemSchema = fieldSchema.items as Record<string, unknown>;
          switch (itemSchema.type) {
            case "boolean":
              fields.push({ name: fieldName, type: "bool", isArray: true });
              break;
            case "string":
              if (itemSchema.contentEncoding != undefined) {
                throw new Error(
                  `Unsupported contentEncoding ${JSON.stringify(
                    itemSchema.contentEncoding,
                  )} for array item`,
                );
              }
              fields.push({ name: fieldName, type: "string", isArray: true });
              break;
            case "number":
            case "integer":
              fields.push({ name: fieldName, type: "float64", isArray: true });
              break;
            case "object": {
              const nestedTypeName = `${typeName}.${fieldName}`;
              const postprocessArrayItem = addFieldsRecursive(
                fieldSchema.items as Record<string, unknown>,
                nestedTypeName,
                keyPath.concat(fieldName),
              );
              const prevPostprocess = postprocessObject;
              postprocessObject = (value) => {
                const arr = value[fieldName];
                if (Array.isArray(arr)) {
                  value[fieldName] = arr.map(postprocessArrayItem);
                }
                return prevPostprocess(value);
              };
              fields.push({
                name: fieldName,
                type: nestedTypeName,
                isComplex: true,
                isArray: true,
              });
              break;
            }
            default:
              throw new Error(`Unsupported array item type: ${JSON.stringify(itemSchema.type)}`);
          }
          break;
        }
        case "null":
        default:
          throw new Error(
            `Unsupported object field type for ${fieldName}: ${JSON.stringify(fieldSchema.type)}`,
          );
      }
    }
    datatypes.set(typeName, { definitions: fields });
    return postprocessObject;
  }

  const postprocessValue = addFieldsRecursive(rootJsonSchema, rootTypeName, []);
  return { datatypes, postprocessValue };
}
