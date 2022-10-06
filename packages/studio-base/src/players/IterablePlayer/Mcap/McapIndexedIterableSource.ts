// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mcap0IndexedReader, Mcap0Types } from "@mcap/core";

import Logger from "@foxglove/log";
import { ParsedChannel, parseChannel } from "@foxglove/mcap-support";
import { Time, fromNanoSec, toNanoSec, compare } from "@foxglove/rostime";
import { Topic, MessageEvent } from "@foxglove/studio";
import {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  IteratorResult,
  MessageIteratorArgs,
} from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";
import { PlayerProblem, TopicStats } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

const log = Logger.getLogger(__filename);

export class McapIndexedIterableSource implements IIterableSource {
  private reader: Mcap0IndexedReader;
  private channelInfoById = new Map<
    number,
    { channel: Mcap0Types.Channel; parsedChannel: ParsedChannel; schemaName: string }
  >();
  private start?: Time;
  private end?: Time;

  public constructor(reader: Mcap0IndexedReader) {
    this.reader = reader;
  }

  public async initialize(): Promise<Initalization> {
    let startTime: bigint | undefined;
    let endTime: bigint | undefined;
    for (const chunk of this.reader.chunkIndexes) {
      if (startTime == undefined || chunk.messageStartTime < startTime) {
        startTime = chunk.messageStartTime;
      }
      if (endTime == undefined || chunk.messageEndTime > endTime) {
        endTime = chunk.messageEndTime;
      }
    }

    const topicStats = new Map<string, TopicStats>();
    const topicsByName = new Map<string, Topic>();
    const datatypes: RosDatatypes = new Map();
    const problems: PlayerProblem[] = [];

    for (const channel of this.reader.channelsById.values()) {
      if (channel.schemaId === 0) {
        problems.push({
          severity: "error",
          message: `Channel ${channel.id} has no schema; channels without schemas are not supported`,
        });
        continue;
      }
      const schema = this.reader.schemasById.get(channel.schemaId);
      if (schema == undefined) {
        problems.push({
          severity: "error",
          message: `Missing schema info for schema id ${channel.schemaId} (channel ${channel.id}, topic ${channel.topic})`,
        });
        continue;
      }

      let parsedChannel;
      try {
        parsedChannel = parseChannel({ messageEncoding: channel.messageEncoding, schema });
      } catch (error) {
        problems.push({
          severity: "error",
          message: `Error in topic ${channel.topic} (channel ${channel.id}): ${error.message}`,
          error,
        });
        continue;
      }
      this.channelInfoById.set(channel.id, { channel, parsedChannel, schemaName: schema.name });

      let topic = topicsByName.get(channel.topic);
      if (!topic) {
        topic = { name: channel.topic, datatype: parsedChannel.fullSchemaName };
        topicsByName.set(channel.topic, topic);

        const numMessages = this.reader.statistics?.channelMessageCounts.get(channel.id);
        if (numMessages != undefined) {
          topicStats.set(channel.topic, { numMessages: Number(numMessages) });
        }
      }
      // Final datatypes is an unholy union of schemas across all channels
      for (const [name, datatype] of parsedChannel.datatypes) {
        datatypes.set(name, datatype);
      }
    }

    this.start = fromNanoSec(startTime ?? 0n);
    this.end = fromNanoSec(endTime ?? startTime ?? 0n);

    return {
      start: this.start,
      end: this.end,
      topics: [...topicsByName.values()],
      datatypes,
      profile: this.reader.header.profile,
      problems,
      publishersByTopic: new Map(),
      topicStats,
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    const topics = args.topics;
    const start = args.start ?? this.start;
    const end = args.end ?? this.end;

    if (topics.length === 0 || !start || !end) {
      return;
    }

    for await (const message of this.reader.readMessages({
      startTime: toNanoSec(start),
      endTime: toNanoSec(end),
      topics,
    })) {
      const channelInfo = this.channelInfoById.get(message.channelId);
      if (!channelInfo) {
        yield {
          connectionId: undefined,
          problem: {
            message: `Received message on channel ${message.channelId} without prior channel info`,
            severity: "error",
          },
          msgEvent: undefined,
        };
        continue;
      }
      try {
        yield {
          connectionId: undefined,
          problem: undefined,
          msgEvent: {
            topic: channelInfo.channel.topic,
            receiveTime: fromNanoSec(message.logTime),
            publishTime: fromNanoSec(message.publishTime),
            message: channelInfo.parsedChannel.deserializer(message.data),
            sizeInBytes: message.data.byteLength,
            schemaName: channelInfo.schemaName,
          },
        };
      } catch (error) {
        yield {
          connectionId: undefined,
          problem: {
            message: `Error decoding message on ${channelInfo.channel.topic}`,
            error,
            severity: "error",
          },
          msgEvent: undefined,
        };
      }
    }
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    const { topics, time } = args;

    const messages: MessageEvent<unknown>[] = [];
    for (const topic of topics) {
      // NOTE: An iterator is made for each topic to get the latest message on that topic.
      // An single iterator for all the topics could result in iterating through many
      // irrelevant messages to get to an older message on a topic.
      for await (const message of this.reader.readMessages({
        endTime: toNanoSec(time),
        topics: [topic],
        reverse: true,
      })) {
        const channelInfo = this.channelInfoById.get(message.channelId);
        if (!channelInfo) {
          log.error(`Missing channel info for channel: ${message.channelId} on topic: ${topic}`);
          continue;
        }

        try {
          messages.push({
            topic: channelInfo.channel.topic,
            receiveTime: fromNanoSec(message.logTime),
            publishTime: fromNanoSec(message.publishTime),
            message: channelInfo.parsedChannel.deserializer(message.data),
            sizeInBytes: message.data.byteLength,
            schemaName: channelInfo.schemaName,
          });
        } catch (err) {
          log.error(err);
        }

        break;
      }
    }
    messages.sort((a, b) => compare(a.receiveTime, b.receiveTime));
    return messages;
  }
}
