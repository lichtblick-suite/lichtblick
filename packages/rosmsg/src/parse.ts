// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { RosMsgField, RosMsgDefinition } from "./types";

// Set of built-in ros types. See http://wiki.ros.org/msg#Field_Types
export const rosPrimitiveTypes: Set<string> = new Set([
  "string",
  "bool",
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "float32",
  "float64",
  "int64",
  "uint64",
  "time",
  "duration",
  "json",
]);

function normalizeType(type: string) {
  // Normalize deprecated aliases.
  let normalizedType = type;
  if (type === "char") {
    normalizedType = "uint8";
  }
  if (type === "byte") {
    normalizedType = "int8";
  }
  return normalizedType;
}

// represents a single line in a message definition type
// e.g. 'string name' 'CustomType[] foo' 'string[3] names'
function newArrayDefinition(
  type: string,
  name: string,
  arrayLength: number | undefined,
): RosMsgField {
  const normalizedType = normalizeType(type);
  return {
    type: normalizedType,
    name,
    isArray: true,
    arrayLength: arrayLength,
    isComplex: !rosPrimitiveTypes.has(normalizedType),
  };
}

function newDefinition(type: string, name: string): RosMsgField {
  const normalizedType = normalizeType(type);
  return {
    type: normalizedType,
    name,
    isArray: false,
    isComplex: !rosPrimitiveTypes.has(normalizedType),
  };
}

const buildType = (lines: { isJson: boolean; line: string }[]): RosMsgDefinition => {
  const definitions: RosMsgField[] = [];
  let complexTypeName: string | undefined;
  lines.forEach(({ isJson, line }) => {
    // remove comments and extra whitespace from each line
    const splits = line
      .replace(/#.*/gi, "")
      .split(" ")
      .filter((word) => word);

    const type = splits[0]?.trim();
    const name = splits[1]?.trim();
    if (type == undefined || name == undefined) {
      return;
    }

    if (type === "MSG:") {
      complexTypeName = name;
    } else if (name.includes("=") || splits.includes("=")) {
      // constant type parsing
      const matches = line.match(/(\S+)\s*=\s*(.*)\s*/);
      if (!matches || matches[1] == undefined || matches[2] == undefined) {
        throw new Error("Malformed line: " + line);
      }
      let match: string = matches[2];
      let value: string | number | boolean = match;
      if (type !== "string") {
        // handle special case of python bool values
        match = match.replace(/True/gi, "true");
        match = match.replace(/False/gi, "false");
        value = match;
        try {
          value = JSON.parse(match.replace(/\s*#.*/g, ""));
        } catch (error) {
          console.warn(`Error in this constant definition: ${line}`);
          throw error;
        }
        if (type === "bool") {
          value = Boolean(value);
        }
      }
      if (
        (type.includes("int") && Number(value) > Number.MAX_SAFE_INTEGER) ||
        Number(value) < Number.MIN_SAFE_INTEGER
      ) {
        console.warn(`Found integer constant outside safe integer range: ${line}`);
      }
      definitions.push({
        type: normalizeType(type),
        name: matches[1],
        isConstant: true,
        value,
      });
    } else if (type.indexOf("]") === type.length - 1) {
      // array type parsing
      const typeSplits = type.split("[");
      const baseType = typeSplits[0];
      const len = typeSplits[1]?.replace("]", "");
      if (baseType == undefined) {
        throw new Error("Error in array type parsing: baseType not defined");
      }
      definitions.push(
        newArrayDefinition(
          baseType,
          name,
          len != undefined && len.length > 0 ? parseInt(len, 10) : undefined,
        ),
      );
    } else {
      definitions.push(newDefinition(isJson ? "json" : type, name));
    }
  });
  return { name: complexTypeName, definitions };
};

const findTypeByName = (types: RosMsgDefinition[], name: string): RosMsgDefinition => {
  const matches = types.filter((type) => {
    const typeName = type.name ?? "";
    // if the search is empty, return unnamed types
    if (name.length === 0) {
      return typeName.length === 0;
    }
    // return if the search is in the type name
    // or matches exactly if a fully-qualified name match is passed to us
    const nameEnd = name.includes("/") ? name : `/${name}`;
    return typeName.endsWith(nameEnd);
  });
  if (matches[0] == undefined) {
    throw new Error(
      `Expected 1 top level type definition for '${name}' but found ${matches.length}`,
    );
  }
  return matches[0];
};

// Given a raw message definition string, parse it into an object representation.
// Example return value:
// [{
//   name: undefined,
//   definitions: [
//     {
//       arrayLength: undefined,
//       isArray: false,
//       isComplex: false,
//       name: "name",
//       type: "string",
//     }, ...
//   ],
// }, ... ]
//
// See unit tests for more examples.
export function parse(messageDefinition: string): RosMsgDefinition[] {
  // read all the lines and remove empties
  const allLines = messageDefinition
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  let definitionLines: { isJson: boolean; line: string }[] = [];
  const types: RosMsgDefinition[] = [];
  let nextDefinitionIsJson = false;
  // group lines into individual definitions
  allLines.forEach((line) => {
    // ignore comment lines unless they start with #pragma rosbag_parse_json
    if (line.startsWith("#")) {
      if (line.startsWith("#pragma rosbag_parse_json")) {
        nextDefinitionIsJson = true;
      }
      return;
    }

    // definitions are split by equal signs
    if (line.startsWith("==")) {
      nextDefinitionIsJson = false;
      types.push(buildType(definitionLines));
      definitionLines = [];
    } else {
      definitionLines.push({ isJson: nextDefinitionIsJson, line });
      nextDefinitionIsJson = false;
    }
  });
  types.push(buildType(definitionLines));

  // Fix up complex type names
  types.forEach(({ definitions }) => {
    definitions.forEach((definition) => {
      if (definition.isComplex ?? false) {
        const foundName = findTypeByName(types, definition.type).name;
        if (foundName === undefined) {
          throw new Error(`Missing type definition for ${definition.type}`);
        }
        definition.type = foundName;
      }
    });
  });

  return types;
}
