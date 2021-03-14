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

const RosPrimitives = {
  bool: null,
  int8: null,
  uint8: null,
  int16: null,
  uint16: null,
  int32: null,
  uint32: null,
  int64: null,
  uint64: null,
  float32: null,
  float64: null,
  string: null,
  time: null,
  duration: null,
  json: null,
};

export type RosPrimitive = keyof typeof RosPrimitives;
export const rosPrimitives: string[] = Object.keys(RosPrimitives);

export type MessagePathFilter = {
  type: "filter";
  path: string[];
  value: void | number | string | { variableName: string; startLoc: number };
  nameLoc: number;
  valueLoc: number;
  repr: string; // the original string representation of the filter
};

// A parsed version of paths.
export type MessagePathPart =
  | { type: "name"; name: string }
  | {
      type: "slice";
      start: number | { variableName: string; startLoc: number };
      end: number | { variableName: string; startLoc: number };
    }
  | MessagePathFilter;

export type RosPath = {
  topicName: string;
  messagePath: MessagePathPart[];
  modifier?: string;
};

// "Structure items" are a more useful version of `datatypes`. They can be
// easily traversed to either validate message paths or generate message paths.
export type MessagePathStructureItemMessage = {
  structureType: "message";
  nextByName: {
    [key: string]: MessagePathStructureItem;
  };
  datatype: string;
};
type MessagePathStructureItemArray = {
  structureType: "array";
  next: MessagePathStructureItem;
  datatype: string;
};
type MessagePathStructureItemPrimitive = {
  structureType: "primitive";
  primitiveType: RosPrimitive;
  datatype: string;
};
export type MessagePathStructureItem =
  | MessagePathStructureItemMessage
  | MessagePathStructureItemArray
  | MessagePathStructureItemPrimitive;
