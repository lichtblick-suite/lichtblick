// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlayerPresence } from "@foxglove/studio-base/players/types";

import { forEachSortedArrays, initRenderStateBuilder } from "./renderState";

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
      sharedPanelState: {},
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

  it("should provide stable time values", () => {
    const buildRenderState = initRenderStateBuilder();
    const initialState: Parameters<typeof buildRenderState>[0] = {
      watchedFields: new Set(["currentTime", "endTime", "previewTime", "startTime"]),
      appSettings: undefined,
      currentFrame: [],
      playerState: {
        presence: PlayerPresence.PRESENT,
        progress: {},
        capabilities: [],
        profile: "test",
        playerId: "123",
        activeData: {
          datatypes: new Map(),
          lastSeekTime: 1,
          currentTime: { sec: 33, nsec: 1 },
          endTime: { sec: 100, nsec: 1 },
          startTime: { sec: 1, nsec: 1 },
          isPlaying: true,
          messages: [],
          speed: 1,
          topics: [],
          topicStats: new Map(),
          totalBytesReceived: 0,
        },
      },
      colorScheme: undefined,
      globalVariables: {},
      hoverValue: {
        value: 2.5,
        componentId: "test",
        type: "PLAYBACK_SECONDS",
      },
      sharedPanelState: {},
      sortedTopics: [{ name: "test", schemaName: "schema" }],
      subscriptions: [{ topic: "test", convertTo: "schema" }],
    };
    const firstRenderState = buildRenderState(initialState);
    expect(firstRenderState).toEqual({
      currentTime: { sec: 33, nsec: 1 },
      endTime: { sec: 100, nsec: 1 },
      previewTime: 3.500000001,
      startTime: { sec: 1, nsec: 1 },
    });

    // need to change something to force a new, defined state
    initialState.watchedFields = new Set(["currentTime", "endTime", "startTime", "topics"]);
    const secondRenderState = buildRenderState(initialState);
    expect(secondRenderState).toEqual({
      currentTime: { sec: 33, nsec: 1 },
      endTime: { sec: 100, nsec: 1 },
      startTime: { sec: 1, nsec: 1 },
      previewTime: 3.500000001,
      topics: [{ datatype: "schema", name: "test", schemaName: "schema" }],
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
      sharedPanelState: {},
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
      sharedPanelState: {},
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

  it("should make allFrames sorted receive time across sorted messagesInTopic", () => {
    const buildRenderState = initRenderStateBuilder();
    const state = buildRenderState({
      watchedFields: new Set(["topics", "allFrames"]),
      playerState: {
        presence: PlayerPresence.INITIALIZING,
        capabilities: [],
        profile: undefined,
        playerId: "test",
        progress: {
          messageCache: {
            startTime: { sec: 0, nsec: 0 },
            blocks: [
              {
                sizeInBytes: 0,
                messagesByTopic: {
                  test1: [
                    {
                      topic: "test1",
                      schemaName: "schema",
                      receiveTime: { sec: 1, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                    {
                      topic: "test1",
                      schemaName: "schema",
                      receiveTime: { sec: 3, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                    {
                      topic: "test1",
                      schemaName: "schema",
                      receiveTime: { sec: 5, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                    {
                      topic: "test1",
                      schemaName: "schema",
                      receiveTime: { sec: 6, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                  ],
                  test2: [
                    {
                      topic: "test2",
                      schemaName: "schema",
                      receiveTime: { sec: 2, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                    {
                      topic: "test2",
                      schemaName: "schema",
                      receiveTime: { sec: 4, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                    {
                      topic: "test2",
                      schemaName: "schema",
                      receiveTime: { sec: 7, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                    {
                      topic: "test2",
                      schemaName: "schema",
                      receiveTime: { sec: 8, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
      appSettings: undefined,
      currentFrame: [],
      colorScheme: undefined,
      globalVariables: {},
      hoverValue: undefined,
      sharedPanelState: {},
      sortedTopics: [
        { name: "test1", schemaName: "schema" },
        { name: "test2", schemaName: "schema" },
      ],
      subscriptions: [
        { topic: "test1", preload: true },
        { topic: "test2", preload: true },
      ],
      messageConverters: [],
    });

    expect(state).toEqual({
      topics: [
        { name: "test1", schemaName: "schema", datatype: "schema" },
        { name: "test2", schemaName: "schema", datatype: "schema" },
      ],
      allFrames: [
        {
          topic: "test1",
          receiveTime: { nsec: 0, sec: 1 },
          schemaName: "schema",
          sizeInBytes: 1,
          message: { from: "allFrames" },
        },
        {
          topic: "test2",
          schemaName: "schema",
          receiveTime: { nsec: 0, sec: 2 },
          sizeInBytes: 1,
          message: { from: "allFrames" },
        },
        {
          topic: "test1",
          receiveTime: { nsec: 0, sec: 3 },
          schemaName: "schema",
          sizeInBytes: 1,
          message: { from: "allFrames" },
        },
        {
          topic: "test2",
          schemaName: "schema",
          receiveTime: { nsec: 0, sec: 4 },
          sizeInBytes: 1,
          message: { from: "allFrames" },
        },
        {
          topic: "test1",
          receiveTime: { nsec: 0, sec: 5 },
          schemaName: "schema",
          sizeInBytes: 1,
          message: { from: "allFrames" },
        },
        {
          topic: "test1",
          schemaName: "schema",
          receiveTime: { nsec: 0, sec: 6 },
          sizeInBytes: 1,
          message: { from: "allFrames" },
        },
        {
          topic: "test2",
          receiveTime: { nsec: 0, sec: 7 },
          schemaName: "schema",
          sizeInBytes: 1,
          message: { from: "allFrames" },
        },
        {
          topic: "test2",
          schemaName: "schema",
          receiveTime: { nsec: 0, sec: 8 },
          sizeInBytes: 1,
          message: { from: "allFrames" },
        },
      ],
    });
  });

  it("should support subscribing to original and converted schemas", () => {
    const buildRenderState = initRenderStateBuilder();
    const state = buildRenderState({
      watchedFields: new Set(["topics", "currentFrame", "allFrames"]),
      playerState: {
        presence: PlayerPresence.INITIALIZING,
        capabilities: [],
        profile: undefined,
        playerId: "test",
        progress: {
          messageCache: {
            startTime: { sec: 0, nsec: 0 },
            blocks: [
              {
                sizeInBytes: 0,
                messagesByTopic: {
                  test: [
                    {
                      topic: "test",
                      schemaName: "schema",
                      receiveTime: { sec: 1, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
      appSettings: undefined,
      currentFrame: [
        {
          topic: "test",
          schemaName: "schema",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
          message: { from: "currentFrame" },
        },
      ],
      colorScheme: undefined,
      globalVariables: {},
      hoverValue: undefined,
      sharedPanelState: {},
      sortedTopics: [{ name: "test", schemaName: "schema" }],
      subscriptions: [
        { topic: "test" },
        { topic: "test", convertTo: "otherSchema", preload: true },
      ],
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
          message: { from: "currentFrame" },
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
            message: { from: "currentFrame" },
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 1,
          },
        },
      ],
      allFrames: [
        {
          message: { from: "allFrames" },
          receiveTime: { nsec: 0, sec: 1 },
          schemaName: "schema",
          sizeInBytes: 1,
          topic: "test",
        },
        {
          message: 1,
          originalMessageEvent: {
            message: { from: "allFrames" },
            receiveTime: { nsec: 0, sec: 1 },
            schemaName: "schema",
            sizeInBytes: 1,
            topic: "test",
          },
          receiveTime: { nsec: 0, sec: 1 },
          schemaName: "otherSchema",
          sizeInBytes: 1,
          topic: "test",
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
      sharedPanelState: {},
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

  // It is valid to register multiple converters all sharing the same _from_ schema and having
  // different _to_ schemas.
  it("should support multiple _from_ converters with different _to_", () => {
    const buildRenderState = initRenderStateBuilder();
    const state = buildRenderState({
      watchedFields: new Set(["topics", "currentFrame", "allFrames"]),
      playerState: {
        presence: PlayerPresence.INITIALIZING,
        capabilities: [],
        profile: undefined,
        playerId: "test",
        progress: {
          messageCache: {
            startTime: { sec: 0, nsec: 0 },
            blocks: [
              {
                sizeInBytes: 0,
                messagesByTopic: {
                  test: [
                    {
                      topic: "test",
                      schemaName: "schema",
                      receiveTime: { sec: 1, nsec: 0 },
                      sizeInBytes: 1,
                      message: { from: "allFrames" },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
      appSettings: undefined,
      currentFrame: [
        {
          topic: "test",
          schemaName: "schema",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
          message: { from: "currentFrame" },
        },
      ],
      colorScheme: undefined,
      globalVariables: {},
      hoverValue: undefined,
      sharedPanelState: {},
      sortedTopics: [{ name: "test", schemaName: "schema" }],
      subscriptions: [
        { topic: "test" },
        { topic: "test", convertTo: "otherSchema", preload: true },
        { topic: "test", convertTo: "anotherSchema", preload: true },
      ],
      messageConverters: [
        {
          fromSchemaName: "schema",
          toSchemaName: "otherSchema",
          converter: () => {
            return 1;
          },
        },
        {
          fromSchemaName: "schema",
          toSchemaName: "anotherSchema",
          converter: () => {
            return 2;
          },
        },
      ],
    });

    expect(state).toEqual({
      topics: [
        {
          name: "test",
          schemaName: "schema",
          datatype: "schema",
          convertibleTo: ["otherSchema", "anotherSchema"],
        },
      ],
      currentFrame: [
        {
          topic: "test",
          schemaName: "schema",
          message: { from: "currentFrame" },
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
            message: { from: "currentFrame" },
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 1,
          },
        },
        {
          topic: "test",
          schemaName: "anotherSchema",
          message: 2,
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 1,
          originalMessageEvent: {
            topic: "test",
            schemaName: "schema",
            message: { from: "currentFrame" },
            receiveTime: { sec: 0, nsec: 0 },
            sizeInBytes: 1,
          },
        },
      ],
      allFrames: [
        {
          message: { from: "allFrames" },
          receiveTime: { nsec: 0, sec: 1 },
          schemaName: "schema",
          sizeInBytes: 1,
          topic: "test",
        },
        {
          message: 1,
          originalMessageEvent: {
            message: { from: "allFrames" },
            receiveTime: { nsec: 0, sec: 1 },
            schemaName: "schema",
            sizeInBytes: 1,
            topic: "test",
          },
          receiveTime: { nsec: 0, sec: 1 },
          schemaName: "otherSchema",
          sizeInBytes: 1,
          topic: "test",
        },
        {
          message: 2,
          originalMessageEvent: {
            message: { from: "allFrames" },
            receiveTime: { nsec: 0, sec: 1 },
            schemaName: "schema",
            sizeInBytes: 1,
            topic: "test",
          },
          receiveTime: { nsec: 0, sec: 1 },
          schemaName: "anotherSchema",
          sizeInBytes: 1,
          topic: "test",
        },
      ],
    });
  });

  it("should correctly avoid rendering when current frame stops changing", () => {
    const buildRenderState = initRenderStateBuilder();

    // The first render with a current frame produces a state with the current frame
    {
      const state = buildRenderState({
        watchedFields: new Set(["currentFrame"]),
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
        sharedPanelState: {},
        sortedTopics: [],
        subscriptions: [{ topic: "test" }],
        messageConverters: [],
      });

      expect(state).toEqual({
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
    }

    // The next render has no current frame for our subscription so we get an undefined current frame
    {
      const state = buildRenderState({
        watchedFields: new Set(["currentFrame"]),
        playerState: undefined,
        appSettings: undefined,
        currentFrame: undefined,
        colorScheme: undefined,
        globalVariables: {},
        hoverValue: undefined,
        sharedPanelState: {},
        sortedTopics: [],
        subscriptions: [{ topic: "test" }],
        messageConverters: [],
      });

      expect(state).toEqual({
        currentFrame: undefined,
      });
    }

    // Rendering again with no current frame should return no render state to indicate no render should happen
    {
      const state = buildRenderState({
        watchedFields: new Set(["currentFrame"]),
        playerState: undefined,
        appSettings: undefined,
        currentFrame: undefined,
        colorScheme: undefined,
        globalVariables: {},
        hoverValue: undefined,
        sharedPanelState: {},
        sortedTopics: [],
        subscriptions: [{ topic: "test" }],
        messageConverters: [],
      });

      expect(state).toEqual(undefined);
    }
  });
});

describe("forEachSortedArrays", () => {
  it("should not call forEach for empty arrays", () => {
    const forEach = jest.fn();
    const arr: number[] = [];
    forEachSortedArrays([arr, arr], (a, b) => a - b, forEach);
    expect(forEach).not.toHaveBeenCalled();
  });
  it("merges arrays with exclusive ranges", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 2, 3];
    const arr2 = [4, 5, 6];

    forEachSortedArrays([arr1, arr2], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("merges two interleaved arrays", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 3, 5];
    const arr2 = [2, 4, 6];

    forEachSortedArrays([arr1, arr2], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("merges three interleaved arrays", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 4, 7];
    const arr2 = [2, 5, 8];
    const arr3 = [3, 6, 9];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("merges three exclusive arrays", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [4, 5, 6];
    const arr2 = [1, 2, 3];
    const arr3 = [7, 8, 9];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("merges three identical arrays", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    const arr3 = [1, 2, 3];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });
  it("merges two identical arrays and one empty array", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    const arr3: number[] = [];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 1, 2, 2, 3, 3]);
  });
  it("merge arrays of all the same number and a sequence of numbers", () => {
    const acc: number[] = [];
    const forEach = (item: number) => acc.push(item);
    const arr1 = [3, 3, 3];
    const arr2 = [1, 2, 3, 4];
    const arr3: number[] = [];

    forEachSortedArrays([arr1, arr2, arr3], (a, b) => a - b, forEach);
    expect(acc).toEqual([1, 2, 3, 3, 3, 3, 4]);
  });
});
