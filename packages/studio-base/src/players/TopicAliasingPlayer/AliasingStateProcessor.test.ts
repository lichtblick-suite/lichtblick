// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Topic } from "@foxglove/studio-base/players/types";

import { AliasingStateProcessor } from "./AliasingStateProcessor";
import { mockPlayerState } from "./mocks";

describe("StateProcessor", () => {
  it("should map messages", () => {
    const topics: Topic[] = [
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/topic_2", schemaName: "whatever" },
    ];
    const state = mockPlayerState(undefined, {
      topics,
      messages: [
        {
          topic: "/topic_1",
          receiveTime: { sec: 0, nsec: 0 },
          message: undefined,
          schemaName: "whatever",
          sizeInBytes: 0,
        },
        {
          topic: "/topic_2",
          receiveTime: { sec: 0, nsec: 0 },
          message: undefined,
          schemaName: "whatever",
          sizeInBytes: 0,
        },
      ],
    });

    const aliasMap = new Map(
      Object.entries({
        "/absent_topic": ["renamed_absent_topic"],
        "/topic_1": ["/renamed_topic_1"],
      }),
    );
    const processor = new AliasingStateProcessor(aliasMap);
    const mapped = processor.process(state, []);
    expect(mapped.activeData?.messages).toEqual([
      expect.objectContaining({ topic: "/topic_1" }),
      expect.objectContaining({ topic: "/renamed_topic_1" }),
      expect.objectContaining({ topic: "/topic_2" }),
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
});
