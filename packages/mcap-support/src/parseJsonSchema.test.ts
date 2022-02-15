// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as protobufjs from "protobufjs";

import { parseJsonSchema } from "./parseJsonSchema";

describe("parseJsonSchema", () => {
  it("rejects invalid schema", () => {
    expect(() => parseJsonSchema({}, "X")).toThrow(`Expected "type": "object"`);
    expect(() => parseJsonSchema({ type: 3 }, "X")).toThrow(`Expected "type": "object"`);
    expect(() => parseJsonSchema({ type: "string" }, "X")).toThrow(`Expected "type": "object"`);
    expect(() =>
      parseJsonSchema({ type: "object", properties: { x: { type: "null" } } }, "X"),
    ).toThrow(`Unsupported object field type for x: "null"`);
    expect(() =>
      parseJsonSchema(
        { type: "object", properties: { x: { type: "string", contentEncoding: "X" } } },
        "X",
      ),
    ).toThrow(`Unsupported contentEncoding "X"`);
    expect(() =>
      parseJsonSchema(
        {
          type: "object",
          properties: {
            x: { type: "array", items: { type: "string", contentEncoding: "base64" } },
          },
        },
        "X",
      ),
    ).toThrow(`Unsupported contentEncoding "base64" for array item`);
  });

  it.each([
    {
      name: "Foo",
      schema: { type: "object", properties: {} },
      expectedDatatypes: new Map([["Foo", { definitions: [] }]]),
      value: {},
      expectedValue: {},
    },

    {
      name: "Foo",
      schema: {
        type: "object",
        properties: {
          str: { type: "string" },
          bin: { type: "string", contentEncoding: "base64" },
          num: { type: "number" },
          int: { type: "integer" },
          bool: { type: "boolean" },
        },
      },
      expectedDatatypes: new Map([
        [
          "Foo",
          {
            definitions: [
              { name: "str", type: "string" },
              { name: "bin", type: "uint8", isArray: true },
              { name: "num", type: "float64" },
              { name: "int", type: "float64" },
              { name: "bool", type: "bool" },
            ],
          },
        ],
      ]),
      value: {
        str: "str",
        bin: protobufjs.util.base64.encode(new Uint8Array([0, 1, 0xfe, 0xff]), 0, 4),
        num: 1.5,
        int: 1.5,
        bool: true,
      },
      expectedValue: {
        str: "str",
        bin: new Uint8Array([0, 1, 0xfe, 0xff]),
        num: 1.5,
        int: 1.5,
        bool: true,
      },
    },

    {
      name: "Foo",
      schema: {
        type: "object",
        properties: {
          str: { type: "array", items: { type: "string" } },
          num: { type: "array", items: { type: "number" } },
          int: { type: "array", items: { type: "integer" } },
          bool: { type: "array", items: { type: "boolean" } },
        },
      },
      expectedDatatypes: new Map([
        [
          "Foo",
          {
            definitions: [
              { name: "str", type: "string", isArray: true },
              { name: "num", type: "float64", isArray: true },
              { name: "int", type: "float64", isArray: true },
              { name: "bool", type: "bool", isArray: true },
            ],
          },
        ],
      ]),
      value: { str: ["str"], num: [1.5], int: [1.5], bool: [true] },
      expectedValue: { str: ["str"], num: [1.5], int: [1.5], bool: [true] },
    },

    {
      name: "Foo",
      schema: {
        type: "object",
        properties: {
          bar: { type: "object", properties: { str: { type: "string" } } },
        },
      },
      expectedDatatypes: new Map([
        ["Foo", { definitions: [{ name: "bar", type: "Foo.bar", isComplex: true }] }],
        ["Foo.bar", { definitions: [{ name: "str", type: "string" }] }],
      ]),
      value: { bar: { str: "str" } },
      expectedValue: { bar: { str: "str" } },
    },

    {
      name: "Foo",
      schema: {
        type: "object",
        properties: {
          bin: { type: "string", contentEncoding: "base64" },
          nested: {
            type: "object",
            properties: {
              bin2: { type: "string", contentEncoding: "base64" },
              bar: {
                type: "array",
                items: {
                  type: "object",
                  properties: { bin3: { type: "string", contentEncoding: "base64" } },
                },
              },
            },
          },
        },
      },
      expectedDatatypes: new Map([
        [
          "Foo",
          {
            definitions: [
              { name: "bin", type: "uint8", isArray: true },
              { name: "nested", type: "Foo.nested", isComplex: true },
            ],
          },
        ],
        [
          "Foo.nested",
          {
            definitions: [
              { name: "bin2", type: "uint8", isArray: true },
              { name: "bar", type: "Foo.nested.bar", isComplex: true, isArray: true },
            ],
          },
        ],
        ["Foo.nested.bar", { definitions: [{ name: "bin3", type: "uint8", isArray: true }] }],
      ]),
      value: {
        bin: protobufjs.util.base64.encode(new Uint8Array([0xa1, 0xb2, 0xc3]), 0, 3),
        nested: {
          bin2: protobufjs.util.base64.encode(new Uint8Array([0xd4, 0xe5, 0xf6]), 0, 3),
          bar: [
            { bin3: protobufjs.util.base64.encode(new Uint8Array([0, 1, 0xfe, 0xff]), 0, 4) },
            { bin3: protobufjs.util.base64.encode(new Uint8Array([2, 3, 0xfe, 0xff]), 0, 4) },
          ],
        },
      },
      expectedValue: {
        bin: new Uint8Array([0xa1, 0xb2, 0xc3]),
        nested: {
          bin2: new Uint8Array([0xd4, 0xe5, 0xf6]),
          bar: [
            { bin3: new Uint8Array([0, 1, 0xfe, 0xff]) },
            { bin3: new Uint8Array([2, 3, 0xfe, 0xff]) },
          ],
        },
      },
    },
  ])(
    "converts schema to datatypes and decodes base64",
    ({ name, schema, expectedDatatypes, value, expectedValue }) => {
      const { datatypes, postprocessValue } = parseJsonSchema(schema, name);
      expect(datatypes).toEqual(expectedDatatypes);
      expect(postprocessValue(value)).toEqual(expectedValue);
    },
  );
});
