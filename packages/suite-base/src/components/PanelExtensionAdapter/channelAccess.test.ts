// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent } from "@lichtblick/suite";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { InstalledMessageConverter } from "@lichtblick/suite-base/types/messageConverters";
import { channelCatalog, convertedChannelId } from "@lichtblick/suite-base/util/channels";
import { topicOutputKey } from "@lichtblick/suite-base/util/topicOutput";

import { createMessageRangeIterator } from "./messageRangeIterator";
import { BuilderRenderStateInput, initRenderStateBuilder } from "./renderState";

const topics = ["first", "second"].map((channelId) => ({
  name: "/shared",
  schemaName: "Input",
  channelId,
}));
const converters: InstalledMessageConverter[] = ["A", "B"].map((converterId) => ({
  converterId,
  fromSchemaName: "Input",
  toSchemaName: "Output",
  converter: (message) => ({ converterId, message }),
}));
const messages: MessageEvent[] = topics.map((topic, index) => ({
  topic: topic.name,
  channelId: topic.channelId,
  schemaName: "Input",
  message: index,
  receiveTime: { sec: index, nsec: 0 },
  sizeInBytes: 1,
}));

function input(): BuilderRenderStateInput {
  return {
    appSettings: undefined,
    colorScheme: undefined,
    hoverValue: undefined,
    sharedPanelState: undefined,
    playerState: undefined,
    currentFrame: messages,
    globalVariables: {},
    sortedTopics: topics,
    messageConverters: converters,
    watchedFields: new Set(["channels", "currentFrame"]),
    forceConversion: new Set(),
    subscriptions: [],
  };
}

it("advertises native and virtual channels and selects exact producers sharing a schema", () => {
  const requested = convertedChannelId("second", "B");
  const state = initRenderStateBuilder()({
    ...input(),
    subscriptions: [{ topic: "/shared", channelId: requested }],
  });
  expect(state?.channels).toEqual(channelCatalog(topics, converters));
  expect(state?.channels).toHaveLength(6);
  expect(state?.currentFrame).toHaveLength(1);
  expect(state?.currentFrame?.[0]).toMatchObject({
    channelId: requested,
    message: { converterId: "B", message: 1 },
    originalMessageEvent: messages[1],
  });
});

it("selects native data and fails closed for missing channels", () => {
  expect(
    initRenderStateBuilder()({
      ...input(),
      subscriptions: [{ topic: "/shared", channelId: "first" }],
    })?.currentFrame,
  ).toEqual([messages[0]]);
  expect(
    initRenderStateBuilder()({
      ...input(),
      subscriptions: [{ topic: "/shared", channelId: "missing" }],
    })?.currentFrame,
  ).toEqual([]);
});

it("passes settings for the selected source channel to its converter", () => {
  const converter: InstalledMessageConverter = {
    ...converters[0]!,
    converter: (_message, event) => event.topicConfig,
  };
  const keys = ["first", "second"].map((sourceChannelId) =>
    topicOutputKey("/shared", {
      kind: "converted",
      sourceSchemaName: "Input",
      converterId: "A",
      sourceChannelId,
    }),
  );
  const result = initRenderStateBuilder()({
    ...input(),
    messageConverters: [converter],
    subscriptions: ["first", "second"].map((id) => ({
      topic: "/shared",
      channelId: convertedChannelId(id, "A"),
    })),
    config: {
      topics: {},
      topicOutputs: {
        "/shared": {
          [keys[0]!]: { size: 2 },
          [keys[1]!]: { size: 5 },
        },
      },
    },
  });
  expect(result?.currentFrame?.map((event) => event.message)).toEqual([{ size: 2 }, { size: 5 }]);
});

it("uses the same virtual channel identity and producer for range access", async () => {
  const requested = convertedChannelId("second", "A");
  const { iterable } = createMessageRangeIterator({
    topic: "/shared",
    channelId: requested,
    sortedTopics: topics,
    messageConverters: converters,
    rawBatchIterator: (async function* () {
      for (const msgEvent of messages) {
        yield { type: "message-event" as const, msgEvent };
      }
    })(),
  });
  const result: MessageEvent[] = [];
  for await (const batch of iterable) {
    result.push(...batch);
  }
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    channelId: requested,
    message: { converterId: "A", message: 1 },
  });
});

it("keeps topic aliases of the same source channel discoverable and reprocesses both", () => {
  const builder = initRenderStateBuilder();
  const currentFrame = [messages[0]!, { ...messages[0]!, topic: "/alias" }];
  const stateInput = {
    ...input(),
    sortedTopics: [topics[0]!, { ...topics[0]!, name: "/alias" }],
    currentFrame,
    subscriptions: ["/shared", "/alias"].map((topic) => ({
      topic,
      channelId: convertedChannelId("first", "A"),
    })),
  };
  expect(builder(stateInput)?.channels).toHaveLength(6);
  const result = builder({ ...stateInput, globalVariables: { changed: true } });
  expect(result?.currentFrame?.map((event) => event.topic)).toEqual(["/shared", "/alias"]);
});

it.each([false, true])("preloads only the selected channel when converted=%s", (converted) => {
  const select = (id: string) => (converted ? convertedChannelId(id, "A") : id);
  const result = initRenderStateBuilder()({
    ...input(),
    watchedFields: new Set(["allFrames"]),
    subscriptions: [
      { topic: "/shared", channelId: select("first"), preload: true },
      { topic: "/shared", channelId: select("second"), preload: false },
    ],
    playerState: {
      playerId: "test",
      presence: PlayerPresence.PRESENT,
      capabilities: [],
      profile: undefined,
      progress: {
        messageCache: {
          startTime: { sec: 0, nsec: 0 },
          blocks: [{ sizeInBytes: 2, messagesByTopic: { "/shared": messages } }],
        },
      },
    },
  });
  expect(result?.allFrames?.map((event) => event.channelId)).toEqual([select("first")]);
});
