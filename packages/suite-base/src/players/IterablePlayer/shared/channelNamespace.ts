// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Immutable, MessageEvent } from "@lichtblick/suite";
import { TopicSelection } from "@lichtblick/suite-base/players/types";

import { IIterableSource, Initialization } from "../IIterableSource";

/** Channel numbers are local to a recording, so qualify them before combining recordings. */
export function namespaceChannels(
  source: IIterableSource<Uint8Array>,
  initialization: Initialization,
  index: number,
): { source: IIterableSource<Uint8Array>; initialization: Initialization } {
  const prefix = `source:${index}:`;
  const qualify = (event: MessageEvent<Uint8Array>): MessageEvent<Uint8Array> =>
    event.channelId == undefined ? event : { ...event, channelId: prefix + event.channelId };
  const localTopics = (topics: Immutable<TopicSelection>): Immutable<TopicSelection> =>
    new Map(
      [...topics].map(([topic, subscription]) => [
        topic,
        {
          ...subscription,
          channelIds: subscription.channelIds
            ?.filter((id) => id.startsWith(prefix))
            .map((id) => id.slice(prefix.length)),
        },
      ]),
    );
  const namespaced = {
    ...initialization,
    topics: initialization.topics.map((topic) =>
      topic.channelId == undefined ? topic : { ...topic, channelId: prefix + topic.channelId },
    ),
  };
  return {
    initialization: namespaced,
    source: {
      initialize: async () => namespaced,
      getStart: () => source.getStart?.(),
      getEnd: () => source.getEnd?.(),
      async *messageIterator(args) {
        for await (const result of source.messageIterator({
          ...args,
          topics: localTopics(args.topics),
        })) {
          yield result.type === "message-event"
            ? { ...result, msgEvent: qualify(result.msgEvent) }
            : result;
        }
      },
      async getBackfillMessages(args) {
        return (
          await source.getBackfillMessages({ ...args, topics: localTopics(args.topics) })
        ).map(qualify);
      },
    },
  };
}
