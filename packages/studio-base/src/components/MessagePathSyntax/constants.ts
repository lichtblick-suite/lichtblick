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
  bool: undefined,
  int8: undefined,
  uint8: undefined,
  int16: undefined,
  uint16: undefined,
  int32: undefined,
  uint32: undefined,
  int64: undefined,
  uint64: undefined,
  float32: undefined,
  float64: undefined,
  string: undefined,
  json: undefined,
};

export type RosPrimitive = keyof typeof RosPrimitives;
export const rosPrimitives = Object.keys(RosPrimitives) as RosPrimitive[];

export type MessagePathFilter = {
  type: "filter";
  path: string[];
  value?: number | string | bigint | { variableName: string; startLoc: number };
  nameLoc: number;
  valueLoc: number;
  repr: string; // the original string representation of the filter
};

// A parsed version of paths.
export type MessagePathPart =
  | {
      type: "name";
      /** Referenced field name */
      name: string;
      /**
       * Original spelling of the field name in the input message path (for accurate reproduction in
       * autocomplete and string length)
       */
      repr: string;
    }
  | {
      type: "slice";
      start: number | { variableName: string; startLoc: number };
      end: number | { variableName: string; startLoc: number };
    }
  | MessagePathFilter;

export type RosPath = {
  /** Referenced topic name */
  topicName: string;
  /**
   * Original spelling of the topic name in the input message path (for accurate reproduction in
   * autocomplete and string length)
   */
  topicNameRepr: string;
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
