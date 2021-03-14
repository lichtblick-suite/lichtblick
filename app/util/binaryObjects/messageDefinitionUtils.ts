// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { sum } from "lodash";
import memoize from "memoize-weak";
import { RosMsgField } from "rosbag";

import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";

const primitiveSizes: Record<string, number> = {
  json: 8,
  string: 8,
  bool: 1,
  int8: 1,
  uint8: 1,
  int16: 2,
  uint16: 2,
  int32: 4,
  uint32: 4,
  float32: 4,
  float64: 8,
  int64: 8,
  uint64: 8,
  time: 8,
  duration: 8,
};

export const primitiveList: Set<string> = new Set(Object.keys(primitiveSizes));

export const typeSize = memoize((typesByName: RosDatatypes, typeName: string): number => {
  if (primitiveSizes[typeName] != null) {
    return primitiveSizes[typeName];
  }
  const messageType = typesByName[typeName];
  if (messageType == null) {
    throw new Error(`Unknown type: ${typeName}`);
  }
  // We add field sizes here, not type sizes. If the type has a field that's an array of strings,
  // it only adds eight bytes to the object's inline size.
  return sum(typesByName[typeName].fields.map((field) => fieldSize(typesByName, field)));
});

// No point in memoizing this -- it can only do O(1) work before hitting `typeSize`, which is
// memoized. Memoizing on the string type name will work better than memoizing on field object
// identity, too.
export function fieldSize(typesByName: RosDatatypes, field: RosMsgField): number {
  if (field.isConstant) {
    return 0;
  }
  if (field.isArray) {
    // NOTE: Fixed-size arrays are not inlined.
    return 2 * primitiveSizes.int32;
  }
  return typeSize(typesByName, field.type);
}

// It's useful for field-accessor code for times and durations to share codepaths with field
// accessor code for complex message types. To do that, we add them to the set of messages.
// (Note, this might change depending on the code written next.)
export const addTimeTypes = (typesByName: RosDatatypes): RosDatatypes => ({
  ...typesByName,
  time: {
    fields: [
      { name: "sec", type: "int32" },
      { name: "nsec", type: "int32" },
    ],
  },
  duration: {
    fields: [
      { name: "sec", type: "int32" },
      { name: "nsec", type: "int32" },
    ],
  },
});

// String.prototype.replaceAll is not implemented in Chrome.
const allBadCharacters = new RegExp("[/-]", "g");
export const friendlyTypeName = (name: string): string => name.replace(allBadCharacters, "_");
export const deepParseSymbol = Symbol("deepParse");
export const classDatatypes = new WeakMap<any, [RosDatatypes, string]>();
export const associateDatatypes = (cls: any, datatypes: [RosDatatypes, string]): void => {
  classDatatypes.set(cls, datatypes);
};
export const getDatatypes = (cls: any): [RosDatatypes, string] | null | undefined =>
  classDatatypes.get(cls);

// Note: returns false for "time" and "duration". Might be more useful not doing that.
// The RosMsgField flow-type has an `isComplex` field, but it isn't present for the websocket
// player, and has gone missing in test fixture before as well. Best to just assume it doesn't
// exist, because it's an annoying denormalization anyway.
export const isComplex = (typeName: string) => !primitiveList.has(typeName);

// True for "object bobjects" and array views.
export const isBobject = (object?: any): boolean => {
  return object?.[deepParseSymbol] != null;
};

export const deepParse = (object?: any): any => {
  if (object == null) {
    // Missing submessage fields are unfortunately common for constructed markers. This is not
    // principled, but it is pragmatic.
    return object;
  }
  if (!isBobject(object)) {
    // This is typically a typing mistake -- the user thinks they have a bobject but have a
    // primitive or a parsed message.
    throw new Error("Argument to deepParse is not a bobject");
  }
  return object[deepParseSymbol]();
};
