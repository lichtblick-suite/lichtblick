// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TopicAliasFunction } from "@foxglove/studio";
import {
  AliasingInputs,
  aliasPlayerState,
} from "@foxglove/studio-base/players/TopicAliasingPlayer/aliasing";
import { Topic } from "@foxglove/studio-base/players/types";

import { mockPlayerState } from "./mocks";

describe("mapPlayerState", () => {
  it("maps blocks", () => {
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
    const inputs: AliasingInputs = {
      aliasFunctions: [
        {
          extensionId: "any",
          aliasFunction: () => [{ sourceTopicName: "/topic_1", name: "/renamed_topic_1" }],
        },
      ],
      topics,
      variables: {},
    };
    const mapped = aliasPlayerState(inputs, [], state);
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
  });

  it("maps messages", () => {
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
    const inputs: AliasingInputs = {
      aliasFunctions: [
        {
          extensionId: "any",
          aliasFunction: () => [
            { sourceTopicName: "/absent_topic", name: "/renamed_absent_topic" },
            { sourceTopicName: "/topic_1", name: "/renamed_topic_1" },
          ],
        },
      ],
      topics,
      variables: {},
    };
    const mapped = aliasPlayerState(inputs, [], state);
    expect(mapped.activeData?.messages).toEqual([
      expect.objectContaining({ topic: "/topic_1" }),
      expect.objectContaining({ topic: "/renamed_topic_1" }),
      expect.objectContaining({ topic: "/topic_2" }),
    ]);
  });

  it("maps published topics", () => {
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
    const inputs: AliasingInputs = {
      aliasFunctions: [
        {
          extensionId: "any",
          aliasFunction: () => [{ sourceTopicName: "/topic_1", name: "/renamed_topic_1" }],
        },
      ],
      topics,
      variables: {},
    };
    const mapped = aliasPlayerState(inputs, [], state);
    expect(mapped.activeData?.publishedTopics).toEqual(
      new Map([
        ["1", new Set(["/topic_1", "/topic_2", "/renamed_topic_1"])],
        ["2", new Set(["/topic_2"])],
      ]),
    );
  });

  it("maps subscribed topics", () => {
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
    const inputs: AliasingInputs = {
      aliasFunctions: [
        {
          extensionId: "any",
          aliasFunction: () => [
            { sourceTopicName: "/topic_1", name: "/renamed_topic_1" },
            { sourceTopicName: "/topic_3", name: "/renamed_topic_3" },
          ],
        },
      ],
      topics,
      variables: {},
    };
    const subscriptions = [{ topic: "/topic_1" }, { topic: "/renamed_topic_1" }];
    const mapped = aliasPlayerState(inputs, subscriptions, state);
    expect(mapped.activeData?.subscribedTopics).toEqual(
      new Map([
        ["1", new Set(["/topic_1", "/renamed_topic_1"])],
        ["2", new Set(["/topic_2"])],
        ["3", new Set(["/topic_1", "/topic_2", "/renamed_topic_1"])],
      ]),
    );
  });

  it("maps topics", () => {
    const topics: Topic[] = [
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/topic_2", schemaName: "whatever" },
    ];
    const state = mockPlayerState(undefined, { topics });
    const inputs: AliasingInputs = {
      aliasFunctions: [
        {
          extensionId: "any",
          aliasFunction: () => [
            { sourceTopicName: "/absent_topic", name: "/renamed_absent_topic" },
            { sourceTopicName: "/topic_1", name: "/renamed_topic_1" },
          ],
        },
      ],
      topics,
      variables: {},
    };
    const mapped = aliasPlayerState(inputs, [], state);
    expect(mapped.activeData?.topics).toEqual([
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/renamed_topic_1", schemaName: "whatever", aliasedFromName: "/topic_1" },
      { name: "/topic_2", schemaName: "whatever" },
    ]);
  });

  it("uses global variables in mapping", () => {
    const topics: Topic[] = [
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/topic_2", schemaName: "whatever" },
    ];
    const state = mockPlayerState(undefined, { topics });
    const inputs: AliasingInputs = {
      aliasFunctions: [
        {
          extensionId: "any",
          aliasFunction: (args: Parameters<TopicAliasFunction>[0]) => [
            { sourceTopicName: "/topic_1", name: `/renamed_topic_${args.globalVariables["foo"]}` },
          ],
        },
      ],
      topics,
      variables: { foo: "bar" },
    };
    const mapped = aliasPlayerState(inputs, [], state);
    expect(mapped.activeData?.topics).toEqual([
      { name: "/topic_1", schemaName: "whatever" },
      { name: "/renamed_topic_bar", schemaName: "whatever", aliasedFromName: "/topic_1" },
      { name: "/topic_2", schemaName: "whatever" },
    ]);
  });
});
