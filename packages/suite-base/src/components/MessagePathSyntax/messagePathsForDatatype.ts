// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import * as _ from "lodash-es";

import {
  MessagePathFilter,
  quoteFieldNameIfNeeded,
  MessagePathPart,
  PrimitiveType,
  MessagePathStructureItem,
  MessagePathStructureItemMessage,
} from "@lichtblick/message-path";
import { Immutable } from "@lichtblick/suite";
import { isTypicalFilterName } from "@lichtblick/suite-base/components/MessagePathSyntax/isTypicalFilterName";
import {
  MessagePathsForStructure,
  MessagePathsForStructureArgs,
  StructureTraversalResult,
} from "@lichtblick/suite-base/components/MessagePathSyntax/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import { assertNever } from "@lichtblick/suite-base/util/assertNever";
import naturalSort from "@lichtblick/suite-base/util/naturalSort";

const STRUCTURE_ITEM_INTEGER_TYPES = [
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
];

function isPrimitiveType(type: string): type is PrimitiveType {
  // casting _as_ PrimitiveType here to have typescript error if add a case to the union
  switch (type as PrimitiveType) {
    case "bool":
    case "int8":
    case "uint8":
    case "int16":
    case "uint16":
    case "int32":
    case "uint32":
    case "int64":
    case "uint64":
    case "float32":
    case "float64":
    case "string":
      return true;
  }
}

function structureItemIsIntegerPrimitive(item: MessagePathStructureItem) {
  return (
    item.structureType === "primitive" && STRUCTURE_ITEM_INTEGER_TYPES.includes(item.primitiveType)
  );
}

// Generate an easily navigable flat structure given some `datatypes`. We cache
// this loosely as `datatypes` don't change after the player has connected.
// The structure looks something like this:
//
// {
//   "/datatype/name": {
//     structureType: "message",
//     nextByName: {
//       "some-sub-field": {
//         structureType: "primitive",
//         primitiveType: "uint8",
//       }
//       "some-boolean-array-sub-field": {
//         structureType: "array",
//         next: {
//           structureType: "primitive",
//           primitiveType: "bool"
//         }
//       }
//     }
//   }
// }

const messagePathStructuresCache = new WeakMap<
  Immutable<RosDatatypes>,
  Record<string, MessagePathStructureItemMessage>
>();

export function messagePathStructures(
  datatypes: Immutable<RosDatatypes>,
): Record<string, MessagePathStructureItemMessage> {
  const cached = messagePathStructuresCache.get(datatypes);
  if (cached) {
    return cached;
  }

  const structureFor = _.memoize(
    (datatype: string, seenDatatypes: string[]): MessagePathStructureItemMessage => {
      const nextByName: Record<string, MessagePathStructureItem> = {};
      const rosDatatype = datatypes.get(datatype);
      if (!rosDatatype) {
        // "time" and "duration" are considered "built-in" types in ROS
        // If we can't find a datatype in our datatypes list we fall-back to our hard-coded versions
        if (datatype === "time" || datatype === "duration") {
          return {
            structureType: "message",
            nextByName: {
              sec: {
                structureType: "primitive",
                primitiveType: "uint32",
                datatype: "",
              },
              nsec: {
                structureType: "primitive",
                primitiveType: "uint32",
                datatype: "",
              },
            },
            datatype,
          };
        }

        throw new Error(`datatype not found: "${datatype}"`);
      }
      for (const msgField of rosDatatype.definitions) {
        if (msgField.isConstant === true) {
          continue;
        }

        if (seenDatatypes.includes(msgField.type)) {
          continue;
        }

        const next: MessagePathStructureItem = isPrimitiveType(msgField.type)
          ? {
              structureType: "primitive",
              primitiveType: msgField.type,
              datatype,
            }
          : structureFor(msgField.type, [...seenDatatypes, msgField.type]);

        if (msgField.isArray === true) {
          nextByName[msgField.name] = { structureType: "array", next, datatype };
        } else {
          nextByName[msgField.name] = next;
        }
      }
      return { structureType: "message", nextByName, datatype };
    },
  );

  const structures: Record<string, MessagePathStructureItemMessage> = {};
  for (const [datatype] of datatypes) {
    structures[datatype] = structureFor(datatype, []);
  }
  messagePathStructuresCache.set(datatypes, structures);

  return structures;
}

export function validTerminatingStructureItem(
  structureItem?: MessagePathStructureItem,
  validTypes?: readonly string[],
): boolean {
  return (
    !!structureItem &&
    (!validTypes ||
      validTypes.includes(structureItem.structureType) ||
      validTypes.includes(structureItem.datatype) ||
      (structureItem.structureType === "primitive" &&
        validTypes.includes(structureItem.primitiveType)))
  );
}

/**
 * Given a datatype, the array of datatypes, and a list of valid types, list out all valid strings
 * for a MessagePathStructure and its corresponding structure item.
 */
const messagePathsCache = new Map<string, MessagePathsForStructure>();

export function messagePathsForStructure(
  structure: MessagePathStructureItemMessage,
  messagePathsStructureArgs?: MessagePathsForStructureArgs,
): MessagePathsForStructure {
  const { validTypes, noMultiSlices, messagePath = [] } = messagePathsStructureArgs ?? {};

  const filterRepr = messagePath
    .filter((part): part is MessagePathFilter => part.type === "filter")
    .map((f) => f.repr)
    .join("|");
  const cacheKey = `${structure.datatype}_${validTypes?.join(",") ?? ""}_${noMultiSlices ?? ""}_${filterRepr}`;
  const cached = messagePathsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let clonedMessagePath = [...messagePath];
  const messagePaths: MessagePathsForStructure = [];
  function traverse(structureItem: MessagePathStructureItem, builtString: string) {
    if (validTerminatingStructureItem(structureItem, validTypes)) {
      messagePaths.push({ path: builtString, terminatingStructureItem: structureItem });
    }
    if (structureItem.structureType === "message") {
      for (const [name, item] of Object.entries(structureItem.nextByName)) {
        traverse(item, `${builtString}.${quoteFieldNameIfNeeded(name)}`);
      }
    } else if (structureItem.structureType === "array") {
      if (structureItem.next.structureType === "message") {
        // When we have an array of messages, you probably want to filter on
        // some field, like `/topic.object{some_id=123}`. If we can't find a
        // typical filter name, fall back to `/topic.object[0]`.
        const typicalFilterItem = Object.entries(structureItem.next.nextByName).find(([name]) =>
          isTypicalFilterName(name),
        );
        if (typicalFilterItem) {
          const [typicalFilterName, typicalFilterValue] = typicalFilterItem;

          // Find matching filter from clonedMessagePath
          const matchingFilterPart = clonedMessagePath.find(
            (pathPart): pathPart is MessagePathFilter =>
              pathPart.type === "filter" && pathPart.path[0] === typicalFilterName,
          );

          // Format the displayed filter value
          if (matchingFilterPart) {
            // Remove the matching filter from clonedMessagePath, for future searches
            clonedMessagePath = clonedMessagePath.filter(
              (pathPart) => pathPart !== matchingFilterPart,
            );
            traverse(structureItem.next, `${builtString}[:]{${matchingFilterPart.repr}}`);
          } else if (structureItemIsIntegerPrimitive(typicalFilterValue)) {
            traverse(structureItem.next, `${builtString}[:]{${typicalFilterName}==0}`);
          } else if (
            typicalFilterValue.structureType === "primitive" &&
            typicalFilterValue.primitiveType === "string"
          ) {
            traverse(structureItem.next, `${builtString}[:]{${typicalFilterName}==""}`);
          } else {
            traverse(structureItem.next, `${builtString}[0]`);
          }
        } else {
          traverse(structureItem.next, `${builtString}[0]`);
        }
      } else if (noMultiSlices !== true) {
        // When dealing with an array of primitives, you likely just want a
        // scatter plot (if we can do multi-slices).
        traverse(structureItem.next, `${builtString}[:]`);
      } else {
        traverse(structureItem.next, `${builtString}[0]`);
      }
    }
  }

  traverse(structure, "");
  const result = messagePaths.sort(naturalSort("path"));

  messagePathsCache.set(cacheKey, result);

  return result;
}

// Traverse down the structure given a `messagePath`. Return if the path
// is valid, given the structure, `validTypes`, and `noMultiSlices`.
//
// We return the `msgPathPart` that was invalid to determine what sort
// of autocomplete we should show.
//
// We use memoizeWeak because it works with multiple arguments (lodash's memoize
// does not) and does not hold onto objects as strongly (it uses WeakMap).
export const traverseStructure = (
  initialStructureItem: MessagePathStructureItem | undefined,
  messagePath: MessagePathPart[],
): StructureTraversalResult => {
  let structureItem = initialStructureItem;
  if (!structureItem) {
    return { valid: false, msgPathPart: undefined, structureItem: undefined };
  }
  for (const msgPathPart of messagePath) {
    if (!structureItem) {
      return { valid: false, msgPathPart, structureItem };
    }
    if (msgPathPart.type === "name") {
      if (structureItem.structureType !== "message") {
        return { valid: false, msgPathPart, structureItem };
      }
      const next: MessagePathStructureItem | undefined = structureItem.nextByName[msgPathPart.name];
      structureItem = next;
    } else if (msgPathPart.type === "slice") {
      if (structureItem.structureType !== "array") {
        return { valid: false, msgPathPart, structureItem };
      }
      structureItem = structureItem.next;
      //eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (msgPathPart.type === "filter") {
      if (
        structureItem.structureType !== "message" ||
        msgPathPart.path.length === 0 ||
        msgPathPart.value == undefined
      ) {
        return { valid: false, msgPathPart, structureItem };
      }
      let currentItem: MessagePathStructureItem | undefined = structureItem;
      for (const name of msgPathPart.path) {
        if (currentItem.structureType !== "message") {
          return { valid: false, msgPathPart, structureItem };
        }
        currentItem = currentItem.nextByName[name];
        if (currentItem == undefined) {
          return { valid: false, msgPathPart, structureItem };
        }
      }
    } else {
      assertNever(
        msgPathPart,
        `Invalid msgPathPart.type: ${(msgPathPart as MessagePathPart).type} `,
      );
    }
  }
  return { valid: true, msgPathPart: undefined, structureItem };
};
