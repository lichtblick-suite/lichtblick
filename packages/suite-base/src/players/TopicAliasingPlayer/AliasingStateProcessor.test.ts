// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Topic } from "@lichtblick/suite-base/players/types";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";

import { AliasingStateProcessor } from "./AliasingStateProcessor";
import { mockPlayerState } from "./mocks";

describe("StateProcessor", () => {
  it("should map messages", () => {
    const topics = PlayerBuilder.topics(2);
    const activeData = PlayerBuilder.activeData({
      topics,
      messages: [
        MessageEventBuilder.messageEvent({ topic: topics[0]?.name }),
        MessageEventBuilder.messageEvent({ topic: topics[1]?.name }),
      ],
    });
    const state = PlayerBuilder.playerState({ activeData });
    const aliasMap = new Map(
      Object.entries({
        "/absent_topic": ["renamed_absent_topic"],
        [topics[0]!.name]: ["/renamedTopic"],
      }),
    );
    const processor = new AliasingStateProcessor(aliasMap);

    const mapped = processor.process(state, []);
    expect(mapped.activeData?.messages).toEqual([
      expect.objectContaining({ topic: topics[0]?.name }),
      expect.objectContaining({ topic: "/renamedTopic" }),
      expect.objectContaining({ topic: topics[1]?.name }),
    ]);

    // Should keep same instance if input is unchanged
    const mapped2 = processor.process(state, []);
    expect(mapped2).not.toBe(mapped);
    expect(mapped2.activeData?.messages).toBe(mapped.activeData?.messages);
  });

  it("should map blocks", () => {
    const topics: Topic[] = [
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/topic_2", schemaName: "whatever" },
    ];
    const state = mockPlayerState(
      {
        progress: {
          fullyLoadedFractionRanges: [],
          messageCache: {
            startTime: { sec: 0, nsec: 1 },
            blocks: [
              {
                messagesByTopic: {
                  "/topic_1": [
                    {
                      topic: "/topic_1",
                      receiveTime: { sec: 0, nsec: 0 },
                      message: undefined,
                      schemaName: "whatever",
                      sizeInBytes: 0,
                    },
                  ],
                  "/topic_2": [
                    {
                      topic: "/topic_2",
                      receiveTime: { sec: 0, nsec: 0 },
                      message: undefined,
                      schemaName: "whatever",
                      sizeInBytes: 0,
                    },
                  ],
                },
                sizeInBytes: 0,
              },
            ],
          },
        },
      },
      {
        topics,
      },
    );

    const aliasMap = new Map(
      Object.entries({
        "/topic_1": ["/renamed_topic_1"],
      }),
    );
    const processor = new AliasingStateProcessor(aliasMap);
    const mapped = processor.process(state, []);
    expect(mapped.progress).toMatchObject({
      messageCache: {
        blocks: [
          {
            messagesByTopic: {
              "/topic_1": [{ topic: "/topic_1" }],
              "/renamed_topic_1": [{ topic: "/renamed_topic_1" }],
              "/topic_2": [{ topic: "/topic_2" }],
            },
            sizeInBytes: 0,
          },
        ],
      },
    });

    // Should keep same instance if input is unchanged
    const mapped2 = processor.process(state, []);
    expect(mapped2).not.toBe(mapped);
    expect(mapped2.progress).toBe(mapped.progress);
  });

  it("should map published topics", () => {
    const topics: Topic[] = [
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/topic_2", schemaName: "whatever" },
    ];
    const state = mockPlayerState(undefined, {
      topics,
      publishedTopics: new Map([
        ["1", new Set(["/topic_1", "/topic_2"])],
        ["2", new Set(["/topic_2"])],
      ]),
    });

    const aliasMap = new Map(
      Object.entries({
        "/topic_1": ["/renamed_topic_1"],
      }),
    );
    const processor = new AliasingStateProcessor(aliasMap);
    const mapped = processor.process(state, []);
    expect(mapped.activeData?.publishedTopics).toEqual(
      new Map([
        ["1", new Set(["/topic_1", "/topic_2", "/renamed_topic_1"])],
        ["2", new Set(["/topic_2"])],
      ]),
    );

    // Should keep same instance if input is unchanged
    const mapped2 = processor.process(state, []);
    expect(mapped2).not.toBe(mapped);
    expect(mapped2.activeData?.publishedTopics).toBe(mapped.activeData?.publishedTopics);
  });

  it("should map topics", () => {
    const topics: Topic[] = [
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/topic_2", schemaName: "whatever" },
    ];
    const state = mockPlayerState(undefined, { topics });

    const aliasMap = new Map(
      Object.entries({
        "/absent_topic": ["/renamed_absent_topic"],
        "/topic_1": ["/renamed_topic_1"],
      }),
    );
    const processor = new AliasingStateProcessor(aliasMap);
    const mapped = processor.process(state, []);
    expect(mapped.activeData?.topics).toEqual([
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/renamed_topic_1", schemaName: "whatever", aliasedFromName: "/topic_1" },
      { name: "/topic_2", schemaName: "whatever" },
    ]);

    // Should keep same instance if input is unchanged
    const mapped2 = processor.process(state, []);
    expect(mapped2).not.toBe(mapped);
    expect(mapped2.activeData?.topics).toBe(mapped.activeData?.topics);
  });

  it("should map subscribed topics", () => {
    const topics: Topic[] = [
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/topic_2", schemaName: "whatever" },
    ];
    const state = mockPlayerState(undefined, {
      topics,
      subscribedTopics: new Map([
        ["1", new Set(["/topic_1"])],
        ["2", new Set(["/topic_2"])],
        ["3", new Set(["/topic_1", "/topic_2"])],
      ]),
    });

    const subscriptions = [{ topic: "/topic_1" }, { topic: "/renamed_topic_1" }];
    const aliasMap = new Map(
      Object.entries({
        "/topic_1": ["/renamed_topic_1"],
        "/topic_3": ["/renamed_topic_3"],
      }),
    );
    const processor = new AliasingStateProcessor(aliasMap);
    const mapped = processor.process(state, subscriptions);

    expect(mapped.activeData?.subscribedTopics).toEqual(
      new Map([
        ["1", new Set(["/topic_1", "/renamed_topic_1"])],
        ["2", new Set(["/topic_2"])],
        ["3", new Set(["/topic_1", "/topic_2", "/renamed_topic_1"])],
      ]),
    );

    // Should keep same instance if input is unchanged
    const mapped2 = processor.process(state, subscriptions);
    expect(mapped2).not.toBe(mapped);
    expect(mapped2.activeData?.subscribedTopics).toBe(mapped.activeData?.subscribedTopics);
  });

  it("should keep existing topic message references in blocks", () => {
    const topics: Topic[] = [
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/topic_2", schemaName: "whatever" },
    ];
    const state = mockPlayerState(
      {
        progress: {
          fullyLoadedFractionRanges: [],
          messageCache: {
            startTime: { sec: 0, nsec: 1 },
            blocks: [
              {
                messagesByTopic: {
                  "/topic_1": [
                    {
                      topic: "/topic_1",
                      receiveTime: { sec: 0, nsec: 0 },
                      message: undefined,
                      schemaName: "whatever",
                      sizeInBytes: 0,
                    },
                  ],
                  "/topic_2": [
                    {
                      topic: "/topic_2",
                      receiveTime: { sec: 0, nsec: 0 },
                      message: undefined,
                      schemaName: "whatever",
                      sizeInBytes: 0,
                    },
                  ],
                },
                sizeInBytes: 0,
              },
            ],
          },
        },
      },
      {
        topics,
      },
    );

    const aliasMap = new Map(
      Object.entries({
        "/topic_1": ["/renamed_topic_1"],
      }),
    );
    const processor = new AliasingStateProcessor(aliasMap);
    const mapped = processor.process(state, []);
    expect(mapped.progress).toMatchObject({
      messageCache: {
        blocks: [
          {
            messagesByTopic: {
              "/topic_1": [{ topic: "/topic_1" }],
              "/renamed_topic_1": [{ topic: "/renamed_topic_1" }],
              "/topic_2": [{ topic: "/topic_2" }],
            },
            sizeInBytes: 0,
          },
        ],
      },
    });

    expect(mapped.progress.messageCache?.blocks[0]?.messagesByTopic["/topic_1"]).toBe(
      state.progress.messageCache?.blocks[0]?.messagesByTopic["/topic_1"],
    );
    expect(mapped.progress.messageCache?.blocks[0]?.messagesByTopic["/topic_2"]).toBe(
      state.progress.messageCache?.blocks[0]?.messagesByTopic["/topic_2"],
    );
  });

  it("should keep aliased block references when processing new blocks", () => {
    const topics: Topic[] = [
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/topic_2", schemaName: "whatever" },
    ];
    const state = mockPlayerState(
      {
        progress: {
          fullyLoadedFractionRanges: [],
          messageCache: {
            startTime: { sec: 0, nsec: 1 },
            blocks: [
              {
                messagesByTopic: {
                  "/topic_1": [
                    {
                      topic: "/topic_1",
                      receiveTime: { sec: 0, nsec: 0 },
                      message: undefined,
                      schemaName: "whatever",
                      sizeInBytes: 0,
                    },
                  ],
                  "/topic_2": [
                    {
                      topic: "/topic_2",
                      receiveTime: { sec: 0, nsec: 0 },
                      message: undefined,
                      schemaName: "whatever",
                      sizeInBytes: 0,
                    },
                  ],
                },
                sizeInBytes: 0,
              },
            ],
          },
        },
      },
      {
        topics,
      },
    );

    const aliasMap = new Map(
      Object.entries({
        "/topic_1": ["/renamed_topic_1"],
      }),
    );
    const processor = new AliasingStateProcessor(aliasMap);
    const mapped = processor.process(state, []);

    const newState = mockPlayerState(
      {
        progress: {
          fullyLoadedFractionRanges: [],
          messageCache: {
            startTime: { sec: 0, nsec: 1 },
            blocks: [
              ...state.progress.messageCache!.blocks,
              {
                messagesByTopic: {
                  "/topic_1": [
                    {
                      topic: "/topic_1",
                      receiveTime: { sec: 0, nsec: 0 },
                      message: undefined,
                      schemaName: "whatever",
                      sizeInBytes: 0,
                    },
                  ],
                },
                sizeInBytes: 0,
              },
            ],
          },
        },
      },
      {
        topics,
      },
    );

    const newMapped = processor.process(newState, []);

    expect(newMapped.progress).toMatchObject({
      messageCache: {
        blocks: [
          {
            messagesByTopic: {
              "/topic_1": [{ topic: "/topic_1" }],
              "/renamed_topic_1": [{ topic: "/renamed_topic_1" }],
              "/topic_2": [{ topic: "/topic_2" }],
            },
            sizeInBytes: 0,
          },
          {
            messagesByTopic: {
              "/topic_1": [{ topic: "/topic_1" }],
              "/renamed_topic_1": [{ topic: "/renamed_topic_1" }],
            },
            sizeInBytes: 0,
          },
        ],
      },
    });

    expect(newMapped.progress.messageCache?.blocks[0]?.messagesByTopic["/topic_1"]).toBe(
      state.progress.messageCache?.blocks[0]?.messagesByTopic["/topic_1"],
    );
    expect(newMapped.progress.messageCache?.blocks[0]?.messagesByTopic["/topic_2"]).toBe(
      state.progress.messageCache?.blocks[0]?.messagesByTopic["/topic_2"],
    );

    // The first block that we previously processed is unchanged and so the output topic messages
    // for the aliased topic should be referentially stable.
    expect(newMapped.progress.messageCache?.blocks[0]?.messagesByTopic["/renamed_topic_1"]).toBe(
      mapped.progress.messageCache?.blocks[0]?.messagesByTopic["/renamed_topic_1"],
    );
  });
});
