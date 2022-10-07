// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mcap0StreamReader, Mcap0Types } from "@mcap/core";
import { isEqual } from "lodash";

import { loadDecompressHandlers, parseChannel, ParsedChannel } from "@foxglove/mcap-support";
import {
  Time,
  isLessThan,
  isGreaterThan,
  isTimeInRangeInclusive,
  fromNanoSec,
  subtract,
  toSec,
  toRFC3339String,
  compare,
} from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  IteratorResult,
  MessageIteratorArgs,
} from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";
import { PlayerProblem, Topic, TopicStats } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

const DURATION_YEAR_SEC = 365 * 24 * 60 * 60;

type Options = { size: number; stream: ReadableStream<Uint8Array> };

export class McapStreamingIterableSource implements IIterableSource {
  private options: Options;
  private msgEventsByChannel?: Map<number, MessageEvent<unknown>[]>;
  private start?: Time;
  private end?: Time;

  public constructor(options: Options) {
    this.options = options;
  }

  public async initialize(): Promise<Initalization> {
    if (this.options.size > 1024 * 1024 * 1024) {
      // This provider uses a simple approach of loading everything into memory up front, so we
      // can't handle large files
      throw new Error("Unable to stream MCAP file; too large");
    }
    const decompressHandlers = await loadDecompressHandlers();

    const streamReader = this.options.stream.getReader();

    const problems: PlayerProblem[] = [];
    const channelIdsWithErrors = new Set<number>();

    const messagesByChannel = new Map<number, MessageEvent<unknown>[]>();
    const schemasById = new Map<number, Mcap0Types.TypedMcapRecords["Schema"]>();
    const channelInfoById = new Map<
      number,
      { channel: Mcap0Types.Channel; parsedChannel: ParsedChannel; schemaName: string }
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
            channelInfoById.set(record.id, {
              channel: record,
              parsedChannel,
              schemaName: schema.name,
            });
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
            schemaName: channelInfo.schemaName,
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

    this.msgEventsByChannel = messagesByChannel;

    const topics: Topic[] = [];
    const topicStats = new Map<string, TopicStats>();
    const datatypes: RosDatatypes = new Map();

    for (const { channel, parsedChannel } of channelInfoById.values()) {
      topics.push({ name: channel.topic, schemaName: parsedChannel.fullSchemaName });
      const numMessages = messagesByChannel.get(channel.id)?.length;
      if (numMessages != undefined) {
        topicStats.set(channel.topic, { numMessages });
      }
      // Final datatypes is an unholy union of schemas across all channels
      for (const [name, datatype] of parsedChannel.datatypes) {
        datatypes.set(name, datatype);
      }
    }

    this.start = startTime ?? { sec: 0, nsec: 0 };
    this.end = endTime ?? { sec: 0, nsec: 0 };

    const fileDuration = toSec(subtract(this.end, this.start));
    if (fileDuration > DURATION_YEAR_SEC) {
      const startRfc = toRFC3339String(this.start);
      const endRfc = toRFC3339String(this.end);

      problems.push({
        message: "This file has an abnormally long duration.",
        tip: `The start ${startRfc} and end ${endRfc} are greater than a year.`,
        severity: "warn",
      });
    }

    problems.push({
      message: "This file unindexed. Unindexed files may have degraded performance.",
      tip: "See the mcap spec: https://mcap.dev/specification/index.html#summary-section",
      severity: "warn",
    });

    return {
      start: this.start,
      end: this.end,
      topics,
      datatypes,
      profile,
      problems,
      publishersByTopic: new Map(),
      topicStats,
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (!this.msgEventsByChannel) {
      throw new Error("initialization not completed");
    }

    const topics = args.topics;
    const start = args.start ?? this.start;
    const end = args.end ?? this.end;

    if (topics.length === 0 || !start || !end) {
      return;
    }

    const topicsSet = new Set(topics);

    for (const [channelId, msgEvents] of this.msgEventsByChannel) {
      for (const msgEvent of msgEvents) {
        if (
          isTimeInRangeInclusive(msgEvent.receiveTime, start, end) &&
          topicsSet.has(msgEvent.topic)
        ) {
          yield {
            connectionId: channelId,
            problem: undefined,
            msgEvent,
          };
        }
      }
    }
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    if (!this.msgEventsByChannel) {
      throw new Error("initialization not completed");
    }

    const needTopics = args.topics;
    const msgEventsByTopic = new Map<string, MessageEvent<unknown>>();
    for (const [_, msgEvents] of this.msgEventsByChannel) {
      for (const msgEvent of msgEvents) {
        if (compare(msgEvent.receiveTime, args.time) <= 0 && needTopics.includes(msgEvent.topic)) {
          msgEventsByTopic.set(msgEvent.topic, msgEvent);
        }
      }
    }
    return [...msgEventsByTopic.values()];
  }
}
