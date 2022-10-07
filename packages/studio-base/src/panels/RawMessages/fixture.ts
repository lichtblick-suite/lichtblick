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

import { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

// ts-prune-ignore-next
export const fixture: Fixture = {
  topics: [
    { name: "/msgs/big_topic", schemaName: "msgs/big_topic" },
    { name: "/foo", schemaName: "std_msgs/String" },
    { name: "/baz/num", schemaName: "baz/num" },
    { name: "/baz/bigint", schemaName: "baz/bigint" },
    { name: "/baz/text", schemaName: "baz/text" },
    { name: "/baz/array", schemaName: "baz/array" },
    { name: "/baz/array/obj", schemaName: "baz/array/obj" },
    { name: "/geometry/types", schemaName: "geometry/types" },
  ],
  frame: {
    "/msgs/big_topic": [
      {
        topic: "/msgs/big_topic",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: {
          LotsOfStuff: {
            SomeBoolean: false,
            SomeInteger: 927364.28391,
            count: 0,
            time: { nsec: 627658424, sec: 1526191529 },
            valid: true,
            str: "a string",
            nothing: undefined,
          },
          timestamp_array: Array(6)
            .fill(undefined)
            .map((_, i) => ({ sec: i, nsec: i })),
          timestamp_example_1: { sec: 0, nsec: 0 },
          timestamp_example_2: { sec: 1, nsec: 1 },
          timestamp_example_3: { sec: 1500000000, nsec: 1 },
          some_id_example_1: { someId: 123, additional_data: 42 },
          some_id_example_2: { some_id: 123 },
          some_short_data: new Int8Array(6),
          some_long_data: new Uint8ClampedArray(2000),
          some_float_data: new Float64Array(10),
          items: [],
          points: [],
        },
        schemaName: "msgs/big_topic",
        sizeInBytes: 0,
      },
    ],
    "/foo": [
      {
        topic: "/foo",
        receiveTime: { sec: 122, nsec: 456789011 },
        message: {
          some_array: ["a", "b", "c"],
          some_deleted_key: "GONE",
          some_id_example_2: { some_id: 0 },
        },
        schemaName: "std_msgs/String",
        sizeInBytes: 0,
      },
      {
        topic: "/foo",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: {
          some_array: ["a", "b", "c", "d", "e", "f"],
          some_id_example_2: { some_id: 123 },
        },
        schemaName: "std_msgs/String",
        sizeInBytes: 0,
      },
    ],
    "/baz/num": [
      {
        topic: "/baz/num",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: { value: 3425363211 },
        schemaName: "baz/num",
        sizeInBytes: 0,
      },
    ],
    "/baz/bigint": [
      {
        topic: "/baz/bigint",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: { value: 18446744073709551615n },
        schemaName: "baz/bigint",
        sizeInBytes: 0,
      },
      {
        topic: "/baz/bigint",
        receiveTime: { sec: 123, nsec: 456789013 },
        message: { value: 18446744073709551616n },
        schemaName: "baz/bigint",
        sizeInBytes: 0,
      },
    ],
    "/baz/text": [
      {
        topic: "/baz/text",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: {
          value: new Array(10).fill("string").join(" "),
          value_long: new Array(1024).fill("string").join(" "),
          value_with_newlines: new Array(1024)
            .fill(0)
            .map((_, i) => `this is line ${i} of the text`)
            .join("\n"),
        },
        schemaName: "baz/text",
        sizeInBytes: 0,
      },
    ],
    "/baz/array": [
      {
        topic: "/baz/array",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: { value: [false] },
        schemaName: "baz/array",
        sizeInBytes: 0,
      },
    ],
    "/baz/array/obj": [
      {
        topic: "/baz/array/obj",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: { value: [{ a: "b", c: "d", e: "f" }] },
        schemaName: "baz/array/obj",
        sizeInBytes: 0,
      },
    ],
    "/geometry/types": [
      {
        topic: "/geometry/types",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: {
          point2d: {
            x: 1.0,
            y: 2.0,
          },
          point3d: {
            x: 1.0,
            y: 2.0,
            z: 3.0,
          },
        },
        schemaName: "geometry/types",
        sizeInBytes: 0,
      },
    ],
  },
  datatypes: new Map(
    Object.entries({
      "baz/num": { definitions: [{ name: "value", type: "float64" }] },
      "baz/bigint": { definitions: [{ name: "value", type: "uint64" }] },
      "baz/text": {
        definitions: [
          { name: "value", type: "string" },
          { name: "value_long", type: "string" },
          { name: "value_with_newlines", type: "string" },
        ],
      },
      "baz/array": { definitions: [{ name: "value", type: "bool", isArray: true }] },
      "baz/array/obj": {
        definitions: [{ name: "value", type: "baz/array/ace", isArray: true, isComplex: true }],
      },
      "baz/array/ace": {
        definitions: [
          { name: "a", type: "string" },
          { name: "c", type: "string" },
          { name: "e", type: "string" },
        ],
      },
      "geometry/types": {
        definitions: [
          { name: "point2d", type: "geometry/types/Point2", isComplex: true },
          { name: "point3d", type: "geometry/types/Point3", isComplex: true },
        ],
      },
      "geometry/types/Point2": {
        definitions: [
          { name: "x", type: "float64" },
          { name: "y", type: "float64" },
        ],
      },
      "geometry/types/Point3": {
        definitions: [
          { name: "x", type: "float64" },
          { name: "y", type: "float64" },
          { name: "z", type: "float64" },
        ],
      },
      "std_msgs/String": { definitions: [{ name: "value", type: "string" }] },
      "msgs/big_topic": {
        definitions: [
          { name: "LotsOfStuff", type: "msgs/LotsOfStuff", isComplex: true },
          { name: "timestamp_example_1", type: "time" },
          { name: "timestamp_example_2", type: "time" },
          { name: "timestamp_example_3", type: "time" },
          { name: "some_id_example_1", type: "msgs/has_id_1", isComplex: true },
          { name: "some_id_example_2", type: "msgs/has_id_2", isComplex: true },
          { name: "some_short_data", type: "int8", isArray: true },
          { name: "some_long_data", type: "uint8", isArray: true },
          { name: "some_float_data", type: "float64", isArray: true },
        ],
      },
      "msgs/LotsOfStuff": {
        definitions: [
          { name: "SomeBoolean", type: "bool" },
          { name: "SomeInteger", type: "float64" },
          { name: "count", type: "int32" },
          { name: "time", type: "time" },
          { name: "valid", type: "bool" },
        ],
      },
      "msgs/has_id_1": {
        definitions: [
          { name: "someId", type: "int32" },
          { name: "additional_data", type: "int32" },
        ],
      },
      "msgs/has_id_2": { definitions: [{ name: "some_id", type: "int32" }] },
    }),
  ),
};

// separate fixture so that we only need to define datatypes for small subset of types
// ts-prune-ignore-next
export const enumFixture: Fixture = {
  datatypes: new Map(
    Object.entries({
      "baz/enum": {
        definitions: [
          { type: "uint8", name: "ERROR", isConstant: true, value: 0 },
          { type: "uint8", name: "OFF", isConstant: true, value: 1 },
          { type: "uint8", name: "BOOTING", isConstant: true, value: 2 },
          { type: "uint8", name: "ACTIVE", isConstant: true, value: 3 },
          { type: "uint8", name: "value", isArray: false },
        ],
      },
    }),
  ),
  topics: [{ name: "/baz/enum", schemaName: "baz/enum" }],
  frame: {
    "/baz/enum": [
      {
        topic: "/baz/enum",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: {
          value: 2,
        },
        schemaName: "baz/enum",
        sizeInBytes: 0,
      },
    ],
  },
};

const exampleMessage = {
  state: 1,
  justField: 0,
  color: 2,
  animal__foxglove_enum: {},
  animal: 10000,
  sentence: 'String with "quotes" and /slashes/.',
};

// ts-prune-ignore-next
export const enumAdvancedFixture: Fixture = {
  datatypes: new Map(
    Object.entries({
      "baz/enum_advanced": {
        definitions: [
          { type: "uint32", name: "OFF", isConstant: true, value: 0 },
          { type: "uint32", name: "ON", isConstant: true, value: 1 },
          { type: "uint32", name: "state", isArray: false },
          { type: "uint32", name: "justField", isArray: false },
          { type: "uint8", name: "RED", isConstant: true, value: 0 },
          { type: "uint8", name: "YELLOW", isConstant: true, value: 1 },
          { type: "uint8", name: "GREEN", isConstant: true, value: 2 },
          { type: "uint8", name: "color", isArray: false },
          { type: "baz/animals", name: "animal__foxglove_enum", isArray: false },
          { type: "uint32", name: "animal", isArray: false },
        ],
      },
      "baz/enum_advanced_array": {
        definitions: [{ type: "baz/enum_advanced", name: "value", isArray: true, isComplex: true }],
      },
      "baz/animals": {
        definitions: [
          { type: "uint32", name: "CAT", isConstant: true, value: 10000 },
          { type: "uint32", name: "DOG", isConstant: true, value: 10001 },
        ],
      },
    }),
  ),
  topics: [{ name: "/baz/enum_advanced", schemaName: "baz/enum_advanced" }],
  frame: {
    "/baz/enum_advanced": [
      {
        topic: "/baz/enum_advanced",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: exampleMessage,
        sizeInBytes: 0,
        schemaName: "baz/enum_advanced",
      },
    ],
  },
};

// ts-prune-ignore-next
export const withMissingData: Fixture = {
  datatypes: new Map(
    Object.entries({
      "baz/missing_data": {
        definitions: [{ type: "uint8", name: "value", isArray: false }],
      },
    }),
  ),
  topics: [{ name: "/baz/missing_data", schemaName: "baz/missing_data" }],
  frame: {
    "/baz/missing_data": [
      {
        topic: "/baz/missing_data",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: {
          value: undefined,
        },
        schemaName: "baz/missing_data",
        sizeInBytes: 0,
      },
    ],
  },
};

// ts-prune-ignore-next
export const topicsToDiffFixture: Fixture = {
  datatypes: enumAdvancedFixture.datatypes,
  topics: [
    { name: "/baz/enum_advanced", schemaName: "baz/enum_advanced" },
    { name: "/another/baz/enum_advanced", schemaName: "baz/enum_advanced" },
  ],
  frame: {
    "/baz/enum_advanced": [
      {
        topic: "/baz/enum_advanced",
        receiveTime: { sec: 123, nsec: 456789012 },
        message: {
          ...exampleMessage,
          toBeDeletedVal: "Bye!",
          toBeDeletedObj: { a: 1, b: 2, c: 3 },
        },
        schemaName: "baz/enum_advanced",
        sizeInBytes: 0,
      },
    ],
    "/another/baz/enum_advanced": [
      {
        ...enumAdvancedFixture.frame!["/baz/enum_advanced"]![0]!,
        topic: "/another/baz/enum_advanced",
        schemaName: "baz/enum_advanced",
        message: {
          ...exampleMessage,
          state: 2,
          color: 3,
          newField: "hello",
          sentence: 'A different string with "quotes" and /slashes/.',
        },
      },
    ],
  },
};

// ts-prune-ignore-next
export const topicsWithIdsToDiffFixture: Fixture = {
  datatypes: enumAdvancedFixture.datatypes,
  topics: [
    { name: "/baz/enum_advanced_array", schemaName: "baz/enum_advanced_array" },
    { name: "/another/baz/enum_advanced_array", schemaName: "baz/enum_advanced_array" },
  ],
  frame: {
    "/baz/enum_advanced_array": [
      {
        receiveTime: enumAdvancedFixture.frame!["/baz/enum_advanced"]![0]!.receiveTime,
        topic: "/baz/enum_advanced_array",
        message: {
          value: [
            {
              ...exampleMessage,
              toBeDeletedVal: "Bye!",
              toBeDeletedObj: { a: 1, b: 2, c: 3 },
              id: 1,
            },
            { ...exampleMessage, id: 2 },
          ],
        },
        schemaName: "baz/enum_advanced_array",
        sizeInBytes: 0,
      },
    ],
    "/another/baz/enum_advanced_array": [
      {
        receiveTime: enumAdvancedFixture.frame!["/baz/enum_advanced"]![0]!.receiveTime,
        topic: "/another/baz/enum_advanced_array",
        message: {
          value: [
            { ...exampleMessage, state: 5, id: 2 },
            { ...exampleMessage, state: 2, color: 3, newField: "hello", id: 1 },
          ],
        },
        schemaName: "baz/enum_advanced_array",
        sizeInBytes: 0,
      },
    ],
  },
};

// ts-prune-ignore-next
export const multipleNumberMessagesFixture: Fixture = {
  datatypes: new Map(
    Object.entries({
      multiple_number_messages: {
        definitions: [{ type: "uint32", name: "value", isArray: false }],
      },
    }),
  ),
  topics: [{ name: "/multiple_number_messages", schemaName: "multiple_number_messages" }],
  frame: {
    "/baz/enum": [
      {
        topic: "/multiple_number_messages",
        receiveTime: { sec: 123, nsec: 1 },
        message: { value: 1 },
        schemaName: "multiple_number_messages",
        sizeInBytes: 0,
      },
      {
        topic: "/multiple_number_messages",
        receiveTime: { sec: 123, nsec: 2 },
        message: { value: 2 },
        schemaName: "multiple_number_messages",
        sizeInBytes: 0,
      },
      {
        topic: "/multiple_number_messages",
        receiveTime: { sec: 123, nsec: 3 },
        message: { value: 3 },
        schemaName: "multiple_number_messages",
        sizeInBytes: 0,
      },
    ],
  },
};

// ts-prune-ignore-next
export const multipleMessagesFilter: Fixture = {
  datatypes: new Map(
    Object.entries({
      custom_message: {
        definitions: [
          { type: "uint32", name: "type", isArray: false },
          { type: "uint32", name: "status", isArray: false },
        ],
      },
    }),
  ),
  topics: [{ name: "/foo", schemaName: "custom_message" }],
  frame: {
    "/foo": [
      {
        topic: "/foo",
        receiveTime: { sec: 123, nsec: 1 },
        message: { type: 2, status: "WAITING" },
        schemaName: "custom_message",
        sizeInBytes: 0,
      },
      {
        topic: "/foo",
        receiveTime: { sec: 123, nsec: 2 },
        message: { type: 1, status: "FAIL" },
        schemaName: "custom_message",
        sizeInBytes: 0,
      },
      {
        topic: "/foo",
        receiveTime: { sec: 123, nsec: 3 },
        message: { type: 2, status: "SUCCESS" },
        schemaName: "custom_message",
        sizeInBytes: 0,
      },
    ],
  },
};
