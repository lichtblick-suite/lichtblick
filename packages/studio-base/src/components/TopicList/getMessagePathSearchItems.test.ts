// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseChannel } from "@foxglove/mcap-support";
import { MessageDefinition } from "@foxglove/message-definition";
import { ImageAnnotations } from "@foxglove/schemas/jsonschema";
import { getMessagePathSearchItems } from "@foxglove/studio-base/components/TopicList/getMessagePathSearchItems";
import { Topic } from "@foxglove/studio-base/players/types";

describe("getMessagePathSearchItems", () => {
  it("returns items with correct paths and types", () => {
    const schemasByName: ReadonlyMap<string, MessageDefinition> = new Map([
      [
        "Foo",
        {
          name: "Foo",
          definitions: [
            { name: "const", type: "float64", isConstant: true, value: 1 },
            { name: "num", type: "float64" },
            { name: "num_array", type: "float64", isArray: true },
            { name: "bar", type: "Bar", isComplex: true },
            { name: "bar_array", type: "Bar", isComplex: true, isArray: true },
          ],
        },
      ],
      [
        "Bar",
        {
          name: "Bar",
          definitions: [
            { name: "const", type: "float64", isConstant: true, value: 1 },
            { name: "str", type: "string" },
            { name: "str_array", type: "string", isArray: true },
          ],
        },
      ],
    ]);
    const topics: Topic[] = [
      { name: "foo1", schemaName: "Foo" },
      { name: "foo2", schemaName: "Foo" },
      { name: "bar", schemaName: "Bar" },
    ];

    expect(getMessagePathSearchItems(topics, schemasByName).items).toEqual([
      {
        topic: { name: "foo1", schemaName: "Foo" },
        fullPath: "foo1.num",
        suffix: { pathSuffix: ".num", type: "float64", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo2", schemaName: "Foo" },
        fullPath: "foo2.num",
        suffix: { pathSuffix: ".num", type: "float64", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo1", schemaName: "Foo" },
        fullPath: "foo1.num_array",
        suffix: { pathSuffix: ".num_array", type: "float64[]", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo2", schemaName: "Foo" },
        fullPath: "foo2.num_array",
        suffix: { pathSuffix: ".num_array", type: "float64[]", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo1", schemaName: "Foo" },
        fullPath: "foo1.bar",
        suffix: { pathSuffix: ".bar", type: "Bar", isLeaf: false },
        offset: 4,
      },
      {
        topic: { name: "foo2", schemaName: "Foo" },
        fullPath: "foo2.bar",
        suffix: { pathSuffix: ".bar", type: "Bar", isLeaf: false },
        offset: 4,
      },
      {
        topic: { name: "foo1", schemaName: "Foo" },
        fullPath: "foo1.bar.str",
        suffix: { pathSuffix: ".bar.str", type: "string", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo2", schemaName: "Foo" },
        fullPath: "foo2.bar.str",
        suffix: { pathSuffix: ".bar.str", type: "string", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo1", schemaName: "Foo" },
        fullPath: "foo1.bar.str_array",
        suffix: { pathSuffix: ".bar.str_array", type: "string[]", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo2", schemaName: "Foo" },
        fullPath: "foo2.bar.str_array",
        suffix: { pathSuffix: ".bar.str_array", type: "string[]", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo1", schemaName: "Foo" },
        fullPath: "foo1.bar_array",
        suffix: { pathSuffix: ".bar_array", type: "Bar[]", isLeaf: false },
        offset: 4,
      },
      {
        topic: { name: "foo2", schemaName: "Foo" },
        fullPath: "foo2.bar_array",
        suffix: { pathSuffix: ".bar_array", type: "Bar[]", isLeaf: false },
        offset: 4,
      },
      {
        topic: { name: "foo1", schemaName: "Foo" },
        fullPath: "foo1.bar_array[:].str",
        suffix: { pathSuffix: ".bar_array[:].str", type: "string", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo2", schemaName: "Foo" },
        fullPath: "foo2.bar_array[:].str",
        suffix: { pathSuffix: ".bar_array[:].str", type: "string", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo1", schemaName: "Foo" },
        fullPath: "foo1.bar_array[:].str_array",
        suffix: { pathSuffix: ".bar_array[:].str_array", type: "string[]", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "foo2", schemaName: "Foo" },
        fullPath: "foo2.bar_array[:].str_array",
        suffix: { pathSuffix: ".bar_array[:].str_array", type: "string[]", isLeaf: true },
        offset: 4,
      },
      {
        topic: { name: "bar", schemaName: "Bar" },
        fullPath: "bar.str",
        suffix: { pathSuffix: ".str", type: "string", isLeaf: true },
        offset: 3,
      },
      {
        topic: { name: "bar", schemaName: "Bar" },
        fullPath: "bar.str_array",
        suffix: { pathSuffix: ".str_array", type: "string[]", isLeaf: true },
        offset: 3,
      },
    ]);
  });

  it("supports cyclic types at root and non-root levels", () => {
    const schemasByName: ReadonlyMap<string, MessageDefinition> = new Map([
      [
        "Foo",
        {
          name: "Foo",
          definitions: [
            { name: "self", type: "Foo", isComplex: true },
            { name: "bar", type: "Bar", isComplex: true },
          ],
        },
      ],
      [
        "Bar",
        {
          name: "Bar",
          definitions: [{ name: "foo", type: "Foo", isComplex: true }],
        },
      ],
    ]);

    expect(
      getMessagePathSearchItems([{ name: "foo", schemaName: "Foo" }], schemasByName).items,
    ).toEqual([
      {
        topic: { name: "foo", schemaName: "Foo" },
        suffix: { pathSuffix: ".self", type: "Foo", isLeaf: false },
        fullPath: "foo.self",
        offset: 3,
      },
      {
        topic: { name: "foo", schemaName: "Foo" },
        suffix: { pathSuffix: ".bar", type: "Bar", isLeaf: false },
        fullPath: "foo.bar",
        offset: 3,
      },
      {
        topic: { name: "foo", schemaName: "Foo" },
        suffix: { pathSuffix: ".bar.foo", type: "Foo", isLeaf: false },
        fullPath: "foo.bar.foo",
        offset: 3,
      },
    ]);

    expect(
      getMessagePathSearchItems([{ name: "bar", schemaName: "Bar" }], schemasByName).items,
    ).toEqual([
      {
        topic: { name: "bar", schemaName: "Bar" },
        suffix: { pathSuffix: ".foo", type: "Foo", isLeaf: false },
        fullPath: "bar.foo",
        offset: 3,
      },
      {
        topic: { name: "bar", schemaName: "Bar" },
        suffix: { pathSuffix: ".foo.self", type: "Foo", isLeaf: false },
        fullPath: "bar.foo.self",
        offset: 3,
      },
      {
        topic: { name: "bar", schemaName: "Bar" },
        suffix: { pathSuffix: ".foo.bar", type: "Bar", isLeaf: false },
        fullPath: "bar.foo.bar",
        offset: 3,
      },
    ]);
  });

  it("includes quoted topic name length in offset", () => {
    const schemasByName: ReadonlyMap<string, MessageDefinition> = new Map([
      [
        "Foo",
        {
          name: "Foo",
          definitions: [{ name: "num", type: "float64" }],
        },
      ],
    ]);

    expect(
      getMessagePathSearchItems([{ name: "foo with spaces", schemaName: "Foo" }], schemasByName)
        .items,
    ).toEqual([
      {
        topic: { name: "foo with spaces", schemaName: "Foo" },
        suffix: { pathSuffix: ".num", type: "float64", isLeaf: true },
        fullPath: `"foo with spaces".num`,
        offset: `"foo with spaces"`.length,
      },
    ]);
  });

  it("works for foxglove.ImageAnnotations", () => {
    const { datatypes } = parseChannel({
      messageEncoding: "json",
      schema: {
        name: "foxglove.ImageAnnotations",
        encoding: "jsonschema",
        data: new TextEncoder().encode(JSON.stringify(ImageAnnotations)),
      },
    });

    expect(
      getMessagePathSearchItems(
        [{ name: "annotations", schemaName: "foxglove.ImageAnnotations" }],
        datatypes,
      ).items,
    ).toMatchInlineSnapshot(`
      [
        {
          "fullPath": "annotations.circles",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".circles",
            "type": "foxglove.ImageAnnotations.circles[]",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].timestamp",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".circles[:].timestamp",
            "type": "foxglove.ImageAnnotations.circles.timestamp",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].timestamp.sec",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].timestamp.sec",
            "type": "uint32",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].timestamp.nsec",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].timestamp.nsec",
            "type": "uint32",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].position",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".circles[:].position",
            "type": "foxglove.ImageAnnotations.circles.position",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].position.x",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].position.x",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].position.y",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].position.y",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].diameter",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].diameter",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].thickness",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].thickness",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].fill_color",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".circles[:].fill_color",
            "type": "foxglove.ImageAnnotations.circles.fill_color",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].fill_color.r",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].fill_color.r",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].fill_color.g",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].fill_color.g",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].fill_color.b",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].fill_color.b",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].fill_color.a",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].fill_color.a",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].outline_color",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".circles[:].outline_color",
            "type": "foxglove.ImageAnnotations.circles.outline_color",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].outline_color.r",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].outline_color.r",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].outline_color.g",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].outline_color.g",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].outline_color.b",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].outline_color.b",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.circles[:].outline_color.a",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".circles[:].outline_color.a",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".points",
            "type": "foxglove.ImageAnnotations.points[]",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].timestamp",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".points[:].timestamp",
            "type": "foxglove.ImageAnnotations.points.timestamp",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].timestamp.sec",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].timestamp.sec",
            "type": "uint32",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].timestamp.nsec",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].timestamp.nsec",
            "type": "uint32",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].type",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].type",
            "type": "uint32",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].points",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".points[:].points",
            "type": "foxglove.ImageAnnotations.points.points[]",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].points[:].x",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].points[:].x",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].points[:].y",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].points[:].y",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_color",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".points[:].outline_color",
            "type": "foxglove.ImageAnnotations.points.outline_color",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_color.r",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].outline_color.r",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_color.g",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].outline_color.g",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_color.b",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].outline_color.b",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_color.a",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].outline_color.a",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_colors",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".points[:].outline_colors",
            "type": "foxglove.ImageAnnotations.points.outline_colors[]",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_colors[:].r",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].outline_colors[:].r",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_colors[:].g",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].outline_colors[:].g",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_colors[:].b",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].outline_colors[:].b",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].outline_colors[:].a",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].outline_colors[:].a",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].fill_color",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".points[:].fill_color",
            "type": "foxglove.ImageAnnotations.points.fill_color",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].fill_color.r",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].fill_color.r",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].fill_color.g",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].fill_color.g",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].fill_color.b",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].fill_color.b",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].fill_color.a",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].fill_color.a",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.points[:].thickness",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".points[:].thickness",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".texts",
            "type": "foxglove.ImageAnnotations.texts[]",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].timestamp",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".texts[:].timestamp",
            "type": "foxglove.ImageAnnotations.texts.timestamp",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].timestamp.sec",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].timestamp.sec",
            "type": "uint32",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].timestamp.nsec",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].timestamp.nsec",
            "type": "uint32",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].position",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".texts[:].position",
            "type": "foxglove.ImageAnnotations.texts.position",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].position.x",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].position.x",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].position.y",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].position.y",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].text",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].text",
            "type": "string",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].font_size",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].font_size",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].text_color",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".texts[:].text_color",
            "type": "foxglove.ImageAnnotations.texts.text_color",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].text_color.r",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].text_color.r",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].text_color.g",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].text_color.g",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].text_color.b",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].text_color.b",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].text_color.a",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].text_color.a",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].background_color",
          "offset": 11,
          "suffix": {
            "isLeaf": false,
            "pathSuffix": ".texts[:].background_color",
            "type": "foxglove.ImageAnnotations.texts.background_color",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].background_color.r",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].background_color.r",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].background_color.g",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].background_color.g",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].background_color.b",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].background_color.b",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
        {
          "fullPath": "annotations.texts[:].background_color.a",
          "offset": 11,
          "suffix": {
            "isLeaf": true,
            "pathSuffix": ".texts[:].background_color.a",
            "type": "float64",
          },
          "topic": {
            "name": "annotations",
            "schemaName": "foxglove.ImageAnnotations",
          },
        },
      ]
    `);
  });
});
