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

import int53 from "int53";

import { cast, Bobject } from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { ArrayView, getArrayView } from "@foxglove-studio/app/util/binaryObjects/ArrayViews";
import getGetClassForView from "@foxglove-studio/app/util/binaryObjects/binaryWrapperObjects";
import getJsWrapperClasses from "@foxglove-studio/app/util/binaryObjects/jsWrapperObjects";
import {
  associateDatatypes,
  deepParseSymbol,
  getDatatypes,
  isBobject,
  primitiveList,
} from "@foxglove-studio/app/util/binaryObjects/messageDefinitionUtils";

const parseJson = (s: string) => {
  try {
    return JSON.parse(s);
  } catch (e) {
    return `Could not parse ${JSON.stringify(s)}`;
  }
};
const context = {
  Buffer,
  getArrayView,
  deepParse: deepParseSymbol,
  int53,
  associateDatatypes,
  parseJson,
};

export type { ArrayView };

type BinaryBobjectData = Readonly<{
  buffer: ArrayBuffer;
  bigString: string;
  offset: number;
  approximateSize: number;
}>;
const binaryData = new WeakMap<any, BinaryBobjectData>();
export const getBinaryData = (bobject: any): BinaryBobjectData | undefined =>
  binaryData.get(bobject);
const reverseWrappedBobjects = new WeakSet<any>();

export const getObject = (
  typesByName: RosDatatypes,
  datatype: string,
  buffer: ArrayBuffer,
  bigString: string,
): Bobject => {
  const Class = getGetClassForView(typesByName, datatype)(
    context,
    new DataView(buffer),
    bigString,
    typesByName,
  );
  const ret = new Class(0);
  binaryData.set(ret, {
    buffer,
    bigString,
    offset: 0,
    approximateSize: buffer.byteLength + bigString.length,
  });
  return ret;
};

export const getObjects = (
  typesByName: RosDatatypes,
  datatype: string,
  buffer: ArrayBuffer,
  bigString: string,
  offsets: readonly number[],
): readonly Bobject[] => {
  const Class = getGetClassForView(typesByName, datatype)(
    context,
    new DataView(buffer),
    bigString,
    typesByName,
  );
  const ret = offsets.map((offset) => new Class(offset));
  // Super dumb heuristic: assume all of the bobjects in a block have the same size. We could do
  // better, but this is only used for memory cache eviction which we do a whole block at a time, so
  // we're only actually interested in the sum (which is correct, plus or minus floating point
  // error).
  const approximateSize = (buffer.byteLength + bigString.length) / offsets.length;
  ret.forEach((bobject, i) => {
    binaryData.set(bobject, { buffer, bigString, offset: offsets[i]!, approximateSize });
  });
  return ret;
};

export { deepParse, isBobject } from "./messageDefinitionUtils";

export const isArrayView = (object: any): boolean => {
  return isBobject(object) && object[Symbol.iterator] != undefined;
};

export const wrapJsObject = <T>(typesByName: RosDatatypes, typeName: string, object: any): T => {
  if (!primitiveList.has(typeName) && !typesByName[typeName]) {
    throw new Error(`Message definition is not present for type ${typeName}.`);
  }
  const classes = getJsWrapperClasses(typesByName);
  const ret = new classes[typeName](object);
  reverseWrappedBobjects.add(ret);
  return cast<T>(ret);
};

// NOTE: The only guarantee is that the sum of the sizes of the bobjects in a given block are
// about right. Sizes are not available for submessages, only top-level bobjects.
// In the future we might make this accurate by getting the data from the binary rewrite step,
// or we might remove this function and just provide access to the identity of the underlying data
// so the shared storage is clear.
export const inaccurateByteSize = (obj: any): number => {
  const data = getBinaryData(obj);
  if (data != undefined) {
    return data.approximateSize;
  }
  if (reverseWrappedBobjects.has(obj)) {
    // Not ideal: Storing the deep-parsed representation of a reverse-wrapped bobject actually
    // does take up memory -- and quite a bit of it. Unfortunately, we don't have a good heuristic
    // for reverse-wrapped bobject sizes.
    return 0;
  }
  throw new Error("Size of object not available");
};

export function bobjectFieldNames(bobject: any): string[] {
  const typeInfo = getDatatypes(Object.getPrototypeOf(bobject).constructor);
  if (!typeInfo) {
    throw new Error("Unknown constructor in bobjectFieldNames");
  }
  const datatype = typeInfo[0][typeInfo[1]];
  if (datatype == undefined) {
    if (typeInfo[1] === "time" || typeInfo[1] === "duration") {
      return ["sec", "nsec"];
    }
    throw new Error(`Unknown datatype ${typeInfo[1]}`);
  }
  return datatype.fields.filter(({ isConstant }) => !isConstant).map(({ name }) => name);
}

export const fieldNames = (o: any): string[] => {
  if (!isBobject(o)) {
    return Object.keys(o);
  }
  return bobjectFieldNames(o);
};

export const merge = <T extends any>(
  bobject: T,
  overrides: Readonly<{
    [field: string]: any;
  }>,
): T => {
  if (!isBobject(bobject)) {
    throw new Error("Argument to merge is not a bobject");
  }
  const shallow: any = {};
  // Iterate over class's methods, except `constructor` which is special.
  bobjectFieldNames(bobject).forEach((field) => {
    // @ts-expect-error: we need to figure out what a bobject actually is
    // seems like it is a Record<string, ()> of some sort
    shallow[field] = bobject[field]();
  });
  const datatypes = getDatatypes(Object.getPrototypeOf(bobject).constructor);
  if (datatypes == undefined) {
    throw new Error("Unknown type in merge");
  }
  return cast<T>(wrapJsObject(datatypes[0], datatypes[1], { ...shallow, ...overrides }));
};

// For accessing fields that might be in bobjects and might be in JS objects.
export const getField = (obj: any | undefined, field: string): any => {
  if (!obj) {
    return;
  }
  if (isBobject(obj)) {
    return obj[field]?.();
  }
  return obj[field];
};

export const getIndex = (obj: any, i: number): any | undefined => {
  if (!obj) {
    return;
  }
  if (isArrayView(obj)) {
    if (i < 0 || i >= obj.length() || !Number.isInteger(i)) {
      return;
    }
    return obj.get(i);
  }
  return obj[i];
};

// Get an individual field by traversing a path of keys and indices
export const getFieldFromPath = (obj: any, path: (string | number)[]): any => {
  let ret = obj;
  for (const field of path) {
    ret = typeof field === "string" ? getField(ret, field) : getIndex(ret, field);
  }
  return ret;
};
