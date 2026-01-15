// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessagePathStructureItem } from "@lichtblick/message-path";
import { isTypicalFilterName } from "@lichtblick/suite-base/components/MessagePathSyntax/isTypicalFilterName";
import {
  DiffObject,
  PathState,
  ValueAction,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import {
  deducePrimitiveType,
  formatValueForFilter,
  isArrayElement,
  isObjectElement,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/utils";

const buildFilterPath = (
  multiSlicePath: string,
  pathItem: string,
  value: unknown,
  structureItem: MessagePathStructureItem | undefined,
): string => {
  if (multiSlicePath.endsWith("[:]") && structureItem?.structureType === "primitive") {
    return `${multiSlicePath}{${pathItem}==${formatValueForFilter(value)}}`;
  }
  return "";
};

const findTypicalFilterName = (
  structureItem: MessagePathStructureItem | undefined,
): string | undefined => {
  if (structureItem?.structureType !== "message") {
    return undefined;
  }
  return Object.entries(structureItem.nextByName).find(
    ([key, nextStructureItem]) =>
      nextStructureItem.structureType === "primitive" && isTypicalFilterName(key),
  )?.[0];
};

const buildSingleSlicePathForArray = (
  pathItem: number,
  value: unknown,
  structureItem: MessagePathStructureItem | undefined,
): string => {
  const typicalFilterName = findTypicalFilterName(structureItem);

  if (typeof value === "object" && value != undefined && typeof typicalFilterName === "string") {
    const filterValue = (value as DiffObject)[typicalFilterName];
    return `[:]{${typicalFilterName}==${formatValueForFilter(filterValue)}}`;
  }

  return `[${pathItem}]`;
};

const processObjectElement = (state: PathState, pathItem: string): PathState => {
  const nextStructureItem =
    state.structureItem?.structureType === "message"
      ? state.structureItem.nextByName[pathItem]
      : undefined;
  const nextValue = (state.value as Record<string, unknown>)[pathItem];

  return {
    singleSlicePath: `${state.singleSlicePath}.${pathItem}`,
    multiSlicePath: `${state.multiSlicePath}.${pathItem}`,
    filterPath: buildFilterPath(state.multiSlicePath, pathItem, nextValue, nextStructureItem),
    value: nextValue,
    structureItem: nextStructureItem,
  };
};

const processArrayElement = (state: PathState, pathItem: number): PathState => {
  const nextValue = (state.value as Record<string, unknown>)[pathItem];
  const nextStructureItem =
    state.structureItem?.structureType === "array" ? state.structureItem.next : undefined;

  return {
    singleSlicePath: `${state.singleSlicePath}${buildSingleSlicePathForArray(
      pathItem,
      nextValue,
      nextStructureItem,
    )}`,
    multiSlicePath: `${state.singleSlicePath}[:]`,
    filterPath: "",
    value: nextValue,
    structureItem: nextStructureItem,
  };
};

const buildValueAction = (state: PathState): ValueAction | undefined => {
  if (state.value == undefined) {
    return undefined;
  }

  // If we know the primitive type from the schema, use it.
  if (state.structureItem?.structureType === "primitive") {
    return {
      singleSlicePath: state.singleSlicePath,
      multiSlicePath: state.multiSlicePath,
      primitiveType: state.structureItem.primitiveType,
      filterPath: state.filterPath,
    };
  }

  // Otherwise, deduce a roughly-correct type from the runtime type of the value.
  const primitiveType = deducePrimitiveType(state.value);
  if (primitiveType != undefined) {
    return {
      singleSlicePath: state.singleSlicePath,
      multiSlicePath: state.multiSlicePath,
      primitiveType,
      filterPath: state.filterPath,
    };
  }

  return undefined;
};

// Given a root value (e.g. a message object), a root structureItem (e.g. a message definition),
// and a key path to navigate down the value and strutureItem (e.g. ["items", 10, "speed"]), return
// a bunch of paths for that navigated down value.
export const getValueActionForValue = (
  rootValue: unknown,
  rootStructureItem: MessagePathStructureItem | undefined,
  keyPath: (number | string)[],
): ValueAction | undefined => {
  let state: PathState = {
    singleSlicePath: "",
    multiSlicePath: "",
    filterPath: "",
    value: rootValue,
    structureItem: rootStructureItem,
  };

  // Walk down the keyPath, while updating the state
  for (const pathItem of keyPath) {
    if (state.value == undefined) {
      break;
    }

    if (isObjectElement(state.value, pathItem, state.structureItem)) {
      state = processObjectElement(state, pathItem as string);
    } else if (isArrayElement(state.value, pathItem, state.structureItem)) {
      state = processArrayElement(state, pathItem as number);
    } else if (state.structureItem?.structureType === "primitive") {
      // ROS has primitives with nested data (time, duration).
      // We currently don't support looking inside them.
      return undefined;
    } else {
      throw new Error(
        `Invalid structureType: ${state.structureItem?.structureType} for value/pathItem.`,
      );
    }
  }

  // At this point we should be looking at a primitive. If not, just return nothing.
  return buildValueAction(state);
};

// Given root structureItem (e.g. a message definition),
// and a key path to navigate down, return strutureItem for the field at that path
export const getStructureItemForPath = (
  rootStructureItem: MessagePathStructureItem | undefined,
  keyPath: (number | string)[],
): MessagePathStructureItem | undefined => {
  let structureItem: MessagePathStructureItem | undefined = rootStructureItem;
  // Walk down the keyPath, while updating `value` and `structureItem`
  for (const pathItem of keyPath) {
    if (structureItem == undefined) {
      break;
    } else if (structureItem.structureType === "message" && typeof pathItem === "string") {
      structureItem = structureItem.nextByName[pathItem];
    } else if (structureItem.structureType === "array" && typeof pathItem === "number") {
      structureItem = structureItem.next;
    } else if (structureItem.structureType === "primitive") {
      // ROS has some primitives that contain nested data (time+duration). We currently don't
      // support looking inside them.
      return structureItem;
    } else {
      throw new Error(`Invalid structureType: ${structureItem.structureType} for value/pathItem.`);
    }
  }
  return structureItem;
};
