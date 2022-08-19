// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mcap0IndexedReader, Mcap0Types } from "@mcap/core";

import { ParsedChannel, parseChannel } from "@foxglove/mcap-support";
import { Time, fromNanoSec, toNanoSec } from "@foxglove/rostime";
import {
  Topic,
  MessageEvent,
  PlayerProblem,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import {
  Connection,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  RandomAccessDataProvider,
  RandomAccessDataProviderProblem,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

export default class Mcap0IndexedDataProvider implements RandomAccessDataProvider {
  private channelInfoById = new Map<
    number,
    { channel: Mcap0Types.Channel; parsedChannel: ParsedChannel }
  >();
  private reportedMissingChannelIds = new Set<number>();
  private reportedChannelsWithInvalidMessages = new Set<number>();

  public constructor(private reader: Mcap0IndexedReader) {}

  public async initialize(_extensionPoint: ExtensionPoint): Promise<InitializationResult> {
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

    const topicsByName = new Map<string, Topic>();
    const topicStats = new Map<string, TopicStats>();
    const connections: Connection[] = [];
    const datatypes: RosDatatypes = new Map();
    const problems: RandomAccessDataProviderProblem[] = [];

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
      this.channelInfoById.set(channel.id, { channel, parsedChannel });

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

    return {
      start: fromNanoSec(startTime ?? 0n),
      end: fromNanoSec(endTime ?? startTime ?? 0n),
      topics: [...topicsByName.values()],
      topicStats,
      connections,
      providesParsedMessages: true,
      profile: this.reader.header.profile,
      messageDefinitions: {
        type: "parsed",
        datatypes,
        messageDefinitionsByTopic: {},
        parsedMessageDefinitionsByTopic: {},
      },
      problems,
    };
  }

  public async getMessages(
    start: Time,
    end: Time,
    subscriptions: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    if (subscriptions.encodedMessages) {
      throw new Error(`${this.constructor.name} only provides parsed messages`);
    }
    let problems: PlayerProblem[] | undefined;
    const parsedMessages: MessageEvent<unknown>[] = [];
    for await (const message of this.reader.readMessages({
      startTime: toNanoSec(start),
      endTime: toNanoSec(end),
      topics: subscriptions.parsedMessages,
    })) {
      const channelInfo = this.channelInfoById.get(message.channelId);
      if (!channelInfo) {
        if (!this.reportedMissingChannelIds.has(message.channelId)) {
          (problems ??= []).push({
            message: `Received message on channel ${message.channelId} without prior channel info`,
            severity: "error",
          });
          this.reportedMissingChannelIds.add(message.channelId);
        }
        continue;
      }
      try {
        parsedMessages.push({
          topic: channelInfo.channel.topic,
          receiveTime: fromNanoSec(message.logTime),
          publishTime: fromNanoSec(message.publishTime),
          message: channelInfo.parsedChannel.deserializer(message.data),
          sizeInBytes: message.data.byteLength,
        });
      } catch (error) {
        if (!this.reportedChannelsWithInvalidMessages.has(message.channelId)) {
          (problems ??= []).push({
            message: `Error decoding message on ${channelInfo.channel.topic}`,
            error,
            severity: "error",
          });
          this.reportedChannelsWithInvalidMessages.add(message.channelId);
        }
      }
    }
    return { parsedMessages, problems };
  }

  public async close(): Promise<void> {}
}
