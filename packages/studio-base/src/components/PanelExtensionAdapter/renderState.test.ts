// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { initRenderStateBuilder } from "./renderState";

describe("renderState", () => {
  it("should include convertibleTo when there are message converters", () => {
    const buildRenderState = initRenderStateBuilder();
    const state = buildRenderState({
      watchedFields: new Set(["topics"]),
      playerState: undefined,
      appSettings: undefined,
      currentFrame: undefined,
      colorScheme: undefined,
      globalVariables: {},
      hoverValue: undefined,
      sortedTopics: [{ name: "test", schemaName: "schema" }],
      subscriptions: [],
      messageConverters: [
        {
          fromSchemaName: "schema",
          toSchemaName: "more",
          converter: () => {},
        },
      ],
    });

    expect(state).toEqual({
      topics: [{ name: "test", schemaName: "schema", datatype: "schema", convertibleTo: ["more"] }],
    });
  });

  it("should avoid conversion if the topic schema is already the desired convertTo schema", () => {
    const buildRenderState = initRenderStateBuilder();
    const state = buildRenderState({
      watchedFields: new Set(["topics", "currentFrame"]),
      playerState: undefined,
      appSettings: undefined,
      currentFrame: [
        {
          topic: "test",
          schemaName: "schema",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {},
        },
      ],
      colorScheme: undefined,
      globalVariables: {},
      hoverValue: undefined,
      sortedTopics: [{ name: "test", schemaName: "schema" }],
      subscriptions: [{ topic: "test", convertTo: "schema" }],
      messageConverters: [],
    });

    expect(state).toEqual({
      topics: [{ name: "test", schemaName: "schema", datatype: "schema" }],
      currentFrame: [
        {
          topic: "test",
          schemaName: "schema",
          message: {},
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
        },
      ],
    });
  });

  it("should subscribe to only the specified topic when using convertTo", () => {
    const buildRenderState = initRenderStateBuilder();
    const state = buildRenderState({
      watchedFields: new Set(["topics", "currentFrame"]),
      playerState: undefined,
      appSettings: undefined,
      currentFrame: [
        {
          topic: "another",
          schemaName: "schema",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {},
        },
        {
          topic: "test",
          schemaName: "schema",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
          message: {},
        },
      ],
      colorScheme: undefined,
      globalVariables: {},
      hoverValue: undefined,
      sortedTopics: [
        { name: "another", schemaName: "schema" },
        { name: "test", schemaName: "schema" },
      ],
      subscriptions: [{ topic: "test", convertTo: "schema" }],
      messageConverters: [],
    });

    expect(state).toEqual({
      topics: [
        { name: "another", schemaName: "schema", datatype: "schema" },
        { name: "test", schemaName: "schema", datatype: "schema" },
      ],
      currentFrame: [
        {
          topic: "test",
          schemaName: "schema",
          message: {},
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
        },
      ],
    });
  });

  it("should support subscribing to original and converted schemas", () => {
    const buildRenderState = initRenderStateBuilder();
    const state = buildRenderState({
      watchedFields: new Set(["topics", "currentFrame"]),
      playerState: undefined,
      appSettings: undefined,
      currentFrame: [
        {
          topic: "test",
          schemaName: "schema",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
          message: {},
        },
      ],
      colorScheme: undefined,
      globalVariables: {},
      hoverValue: undefined,
      sortedTopics: [{ name: "test", schemaName: "schema" }],
      subscriptions: [{ topic: "test" }, { topic: "test", convertTo: "otherSchema" }],
      messageConverters: [
        {
          fromSchemaName: "schema",
          toSchemaName: "otherSchema",
          converter: () => {
            return 1;
          },
        },
      ],
    });

    expect(state).toEqual({
      topics: [
        { name: "test", schemaName: "schema", datatype: "schema", convertibleTo: ["otherSchema"] },
      ],
      currentFrame: [
        {
          topic: "test",
          schemaName: "schema",
          message: {},
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
        },
        {
          topic: "test",
          schemaName: "otherSchema",
          message: 1,
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
          originalMessageEvent: {
            topic: "test",
            schemaName: "schema",
            message: {},
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 1,
          },
        },
      ],
    });
  });

  // Test that the correct converter is run when fromSchema and toSchema produce the same string
  // for two different converters.
  it("should run the correct converter", () => {
    const buildRenderState = initRenderStateBuilder();
    const state = buildRenderState({
      watchedFields: new Set(["topics", "currentFrame"]),
      playerState: undefined,
      appSettings: undefined,
      currentFrame: [
        {
          topic: "another",
          schemaName: "srcschema",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
          message: {},
        },
      ],
      colorScheme: undefined,
      globalVariables: {},
      hoverValue: undefined,
      sortedTopics: [
        { name: "another", schemaName: "srcschema" },
        { name: "test", schemaName: "srcschemade" },
      ],
      subscriptions: [{ topic: "another", convertTo: "destschema" }],
      messageConverters: [
        {
          fromSchemaName: "srcschema",
          toSchemaName: "destschema",
          converter: () => {
            return "srcschema-destschema";
          },
        },
        {
          fromSchemaName: "srcschemade",
          toSchemaName: "stschema",
          converter: () => {
            return "srcschemade-stschema";
          },
        },
      ],
    });

    expect(state).toEqual({
      topics: [
        {
          name: "another",
          schemaName: "srcschema",
          datatype: "srcschema",
          convertibleTo: ["destschema"],
        },
        {
          name: "test",
          schemaName: "srcschemade",
          datatype: "srcschemade",
          convertibleTo: ["stschema"],
        },
      ],
      currentFrame: [
        {
          topic: "another",
          schemaName: "destschema",
          message: "srcschema-destschema",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
          originalMessageEvent: {
            topic: "another",
            schemaName: "srcschema",
            message: {},
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 1,
          },
        },
      ],
    });
  });
});
