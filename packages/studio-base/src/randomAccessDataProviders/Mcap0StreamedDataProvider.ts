// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mcap0StreamReader, Mcap0Types } from "@mcap/core";
import { isEqual } from "lodash";

import { loadDecompressHandlers, parseChannel, ParsedChannel } from "@foxglove/mcap-support";
import {
  Time,
  compare,
  isLessThan,
  isGreaterThan,
  isTimeInRangeInclusive,
  fromNanoSec,
} from "@foxglove/rostime";
import { MessageEvent, Topic, TopicStats } from "@foxglove/studio-base/players/types";
import {
  RandomAccessDataProvider,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  Connection,
  RandomAccessDataProviderProblem,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

type Options = { size: number; stream: ReadableStream<Uint8Array> };

export default class Mcap0StreamedDataProvider implements RandomAccessDataProvider {
  private options: Options;
  private messagesByChannel?: Map<number, MessageEvent<unknown>[]>;

  public constructor(options: Options) {
    this.options = options;
  }

  public async initialize(_extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    if (this.options.size > 1024 * 1024 * 1024) {
      // This provider uses a simple approach of loading everything into memory up front, so we
      // can't handle large files
      throw new Error("Unable to stream MCAP file; too large");
    }
    const decompressHandlers = await loadDecompressHandlers();

    const streamReader = this.options.stream.getReader();

    const problems: RandomAccessDataProviderProblem[] = [];
    const channelIdsWithErrors = new Set<number>();

    const messagesByChannel = new Map<number, MessageEvent<unknown>[]>();
    const schemasById = new Map<number, Mcap0Types.TypedMcapRecords["Schema"]>();
    const channelInfoById = new Map<
      number,
      { channel: Mcap0Types.Channel; parsedChannel: ParsedChannel }
    >();

    let startTime: Time | undefined;
    let endTime: Time | undefined;
    let profile: string | undefined;
    function processRecord(record: Mcap0Types.TypedMcapRecord) {
      switch (record.type) {
        default:
          break;

        case "Header": {
          profile = record.profile;
          break;
        }

        case "Schema": {
          const existingSchema = schemasById.get(record.id);
          if (existingSchema) {
            if (!isEqual(existingSchema, record)) {
              throw new Error(`differing schemas for id ${record.id}`);
            }
          }
          schemasById.set(record.id, record);
          break;
        }

        case "Channel": {
          const existingInfo = channelInfoById.get(record.id);
          if (existingInfo) {
            if (!isEqual(existingInfo.channel, record)) {
              throw new Error(`differing channel infos for id ${record.id}`);
            }
            break;
          }
          if (channelIdsWithErrors.has(record.id)) {
            break;
          }
          if (record.schemaId === 0) {
            throw new Error(
              `Channel ${record.id} has no schema; channels without schemas are not supported`,
            );
          }
          const schema = schemasById.get(record.schemaId);
          if (!schema) {
            throw new Error(
              `Encountered channel with schema id ${record.schemaId} but no prior schema`,
            );
          }

          try {
            const parsedChannel = parseChannel({ messageEncoding: record.messageEncoding, schema });
            channelInfoById.set(record.id, { channel: record, parsedChannel });
            messagesByChannel.set(record.id, []);
          } catch (error) {
            channelIdsWithErrors.add(record.id);
            problems.push({
              severity: "error",
              message: `Error in topic ${record.topic} (channel ${record.id}): ${error.message}`,
              error,
            });
          }
          break;
        }

        case "Message": {
          const channelId = record.channelId;
          const channelInfo = channelInfoById.get(channelId);
          const messages = messagesByChannel.get(channelId);
          if (!channelInfo || !messages) {
            if (channelIdsWithErrors.has(channelId)) {
              break; // error has already been reported
            }
            throw new Error(`message for channel ${channelId} with no prior channel info`);
          }
          const receiveTime = fromNanoSec(record.logTime);
          if (!startTime || isLessThan(receiveTime, startTime)) {
            startTime = receiveTime;
          }
          if (!endTime || isGreaterThan(receiveTime, endTime)) {
            endTime = receiveTime;
          }

          messages.push({
            topic: channelInfo.channel.topic,
            receiveTime,
            publishTime: fromNanoSec(record.publishTime),
            message: channelInfo.parsedChannel.deserializer(record.data),
            sizeInBytes: record.data.byteLength,
          });
          break;
        }
      }
    }

    const reader = new Mcap0StreamReader({ decompressHandlers });
    for (let result; (result = await streamReader.read()), !result.done; ) {
      reader.append(result.value);
      for (let record; (record = reader.nextRecord()); ) {
        processRecord(record);
      }
    }

    this.messagesByChannel = messagesByChannel;

    const topics: Topic[] = [];
    const topicStats = new Map<string, TopicStats>();
    const connections: Connection[] = [];
    const datatypes: RosDatatypes = new Map();

    for (const { channel, parsedChannel } of channelInfoById.values()) {
      topics.push({ name: channel.topic, datatype: parsedChannel.fullSchemaName });
      const numMessages = messagesByChannel.get(channel.id)?.length;
      if (numMessages != undefined) {
        topicStats.set(channel.topic, { numMessages });
      }
      // Final datatypes is an unholy union of schemas across all channels
      for (const [name, datatype] of parsedChannel.datatypes) {
        datatypes.set(name, datatype);
      }
    }

    return {
      start: startTime ?? { sec: 0, nsec: 0 },
      end: endTime ?? { sec: 0, nsec: 0 },
      topics,
      topicStats,
      connections,
      providesParsedMessages: true,
      profile,
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
    if (!this.messagesByChannel) {
      throw new Error("initialization not completed");
    }
    const topics = subscriptions.parsedMessages;
    if (topics == undefined) {
      return {};
    }
    const topicsSet = new Set(topics);

    const parsedMessages: MessageEvent<unknown>[] = [];
    for (const messages of this.messagesByChannel.values()) {
      for (const message of messages) {
        if (
          isTimeInRangeInclusive(message.receiveTime, start, end) &&
          topicsSet.has(message.topic)
        ) {
          parsedMessages.push(message);
        }
      }
    }
    parsedMessages.sort((msg1, msg2) => compare(msg1.receiveTime, msg2.receiveTime));

    return { parsedMessages };
  }

  public async close(): Promise<void> {}
}
