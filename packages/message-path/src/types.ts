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

export type PrimitiveType =
  | "bool"
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "int64"
  | "uint64"
  | "float32"
  | "float64"
  | "string";

export type OperatorType = "==" | "!=" | "<=" | ">=" | "<" | ">";

export type MessagePathFilter = {
  type: "filter";
  path: string[];
  value?: number | string | bigint | { variableName: string; startLoc: number };
  nameLoc: number;
  valueLoc: number;
  repr: string; // the original string representation of the filter
  operator: OperatorType;
};

export type MessagePathName = {
  type: "name";
  /** Referenced field name */
  name: string;
  /**
   * Original spelling of the field name in the input message path (for accurate reproduction in
   * autocomplete and string length)
   */
  repr: string;
};

type MessagePathSlice = {
  type: "slice";
  start: number | { variableName: string; startLoc: number };
  end: number | { variableName: string; startLoc: number };
};

// A parsed version of paths.
export type MessagePathPart = MessagePathName | MessagePathSlice | MessagePathFilter;

export type MessagePath = {
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
  primitiveType: PrimitiveType;
  datatype: string;
};
export type MessagePathStructureItem =
  | MessagePathStructureItemMessage
  | MessagePathStructureItemArray
  | MessagePathStructureItemPrimitive;
