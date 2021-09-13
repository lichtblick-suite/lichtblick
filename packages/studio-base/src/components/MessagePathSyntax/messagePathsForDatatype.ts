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

import { memoize } from "lodash";
import memoizeWeak from "memoize-weak";

import { isTypicalFilterName } from "@foxglove/studio-base/components/MessagePathSyntax/isTypicalFilterName";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { assertNever } from "@foxglove/studio-base/util/assertNever";
import naturalSort from "@foxglove/studio-base/util/naturalSort";

import {
  MessagePathPart,
  rosPrimitives,
  RosPrimitive,
  MessagePathStructureItem,
  MessagePathStructureItemMessage,
} from "./constants";

function isRosPrimitive(type: string): type is RosPrimitive {
  return rosPrimitives.includes(type as RosPrimitive);
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
let lastDatatypes: RosDatatypes | undefined;
let lastStructures: Record<string, MessagePathStructureItemMessage> | undefined;
export function messagePathStructures(
  datatypes: RosDatatypes,
): Record<string, MessagePathStructureItemMessage> {
  if (lastDatatypes === datatypes && lastStructures) {
    return lastStructures;
  }

  lastDatatypes = undefined;
  const structureFor = memoize((datatype: string): MessagePathStructureItemMessage => {
    const nextByName: Record<string, MessagePathStructureItem> = {};
    const rosDatatype = datatypes.get(datatype);
    if (!rosDatatype) {
      throw new Error(`datatype not found: "${datatype}"`);
    }
    rosDatatype.definitions.forEach((msgField) => {
      if (msgField.isConstant === true) {
        return;
      }

      const next: MessagePathStructureItem = isRosPrimitive(msgField.type)
        ? {
            structureType: "primitive",
            primitiveType: msgField.type,
            datatype,
          }
        : structureFor(msgField.type);

      if (msgField.isArray === true) {
        nextByName[msgField.name] = { structureType: "array", next, datatype };
      } else {
        nextByName[msgField.name] = next;
      }
    });
    return { structureType: "message", nextByName, datatype };
  });

  lastStructures = {};
  for (const [datatype] of datatypes) {
    lastStructures[datatype] = structureFor(datatype);
  }
  lastDatatypes = datatypes; // Set at the very end, in case there's an error earlier.
  return lastStructures;
}

export function validTerminatingStructureItem(
  structureItem?: MessagePathStructureItem,
  validTypes?: string[],
): boolean {
  return (
    !!structureItem &&
    (!validTypes ||
      validTypes.includes(structureItem.structureType) ||
      (structureItem.structureType === "primitive" &&
        validTypes.includes(structureItem.primitiveType)))
  );
}

// Given a datatype, the array of datatypes, and a list of valid types,
// list out all valid strings for the `messagePath` part of the path (sorted).
export function messagePathsForDatatype(
  datatype: string,
  datatypes: RosDatatypes,
  {
    validTypes,
    noMultiSlices,
    messagePath = [],
  }: {
    validTypes?: string[];
    noMultiSlices?: boolean;
    messagePath?: MessagePathPart[];
  } = {},
): string[] {
  let clonedMessagePath = [...messagePath];
  const messagePaths: string[] = [];
  function traverse(structureItem: MessagePathStructureItem, builtString: string) {
    if (validTerminatingStructureItem(structureItem, validTypes)) {
      messagePaths.push(builtString);
    }
    if (structureItem.structureType === "message") {
      for (const [name, item] of Object.entries(structureItem.nextByName)) {
        traverse(item, `${builtString}.${name}`);
      }
    } else if (structureItem.structureType === "array") {
      if (structureItem.next.structureType === "message") {
        // When we have an array of messages, you probably want to filter on
        // some field, like `/topic.object{some_id=123}`. If we can't find a
        // typical filter name, fall back to `/topic.object[0]`.
        const typicalFilterName = Object.keys(structureItem.next.nextByName).find((key) =>
          isTypicalFilterName(key),
        );
        if (typicalFilterName != undefined) {
          // Find matching filter from clonedMessagePath
          const matchingFilterPart = clonedMessagePath.find(
            (pathPart) => pathPart.type === "filter" && pathPart.path[0] === typicalFilterName,
          );

          // Remove the matching filter from clonedMessagePath, for future searches
          clonedMessagePath = clonedMessagePath.filter(
            (pathPart) => pathPart !== matchingFilterPart,
          );

          // Format the displayed filter value
          const filterVal =
            matchingFilterPart &&
            matchingFilterPart.type === "filter" &&
            matchingFilterPart.value != undefined
              ? matchingFilterPart.value
              : 0;
          traverse(
            structureItem.next,
            `${builtString}[:]{${typicalFilterName}==${
              typeof filterVal === "object" ? `$${filterVal.variableName}` : filterVal
            }}`,
          );
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
  const structureItem = messagePathStructures(datatypes)[datatype];
  if (structureItem != undefined) {
    traverse(structureItem, "");
  }
  return messagePaths.sort(naturalSort());
}

export type StructureTraversalResult = {
  valid: boolean;
  msgPathPart?: MessagePathPart;
  structureItem?: MessagePathStructureItem;
};

// Traverse down the structure given a `messagePath`. Return if the path
// is valid, given the structure, `validTypes`, and `noMultiSlices`.
//
// We return the `msgPathPart` that was invalid to determine what sort
// of autocomplete we should show.
//
// We use memoizeWeak because it works with multiple arguments (lodash's memoize
// does not) and does not hold onto objects as strongly (it uses WeakMap).
export const traverseStructure = memoizeWeak(
  (
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
      if ("primitiveType" in structureItem && structureItem.primitiveType === "json") {
        // No need to continue validating if we're dealing with JSON. We
        // essentially treat all nested values as valid.
        continue;
      } else if (msgPathPart.type === "name") {
        if (structureItem.structureType !== "message") {
          return { valid: false, msgPathPart, structureItem };
        }
        const next: MessagePathStructureItem | undefined =
          structureItem.nextByName[msgPathPart.name];
        const nextStructureIsJson: boolean =
          next != undefined && next.structureType === "primitive" && next.primitiveType === "json";
        structureItem = !nextStructureIsJson
          ? next
          : {
              structureType: "primitive",
              primitiveType: "json",
              datatype: next ? next.datatype : "",
            };
      } else if (msgPathPart.type === "slice") {
        if (structureItem.structureType !== "array") {
          return { valid: false, msgPathPart, structureItem };
        }
        structureItem = structureItem.next;
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
          `Invalid msgPathPart.type: ${(msgPathPart as MessagePathPart).type}`,
        );
      }
    }
    return { valid: true, msgPathPart: undefined, structureItem };
  },
);
