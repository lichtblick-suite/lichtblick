// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual, maxBy, minBy } from "lodash";

import Logger from "@foxglove/log";
import { parseChannel } from "@foxglove/mcap-support";
import {
  clampTime,
  fromRFC3339String,
  isGreaterThan,
  isLessThan,
  Time,
  toRFC3339String,
} from "@foxglove/rostime";
import {
  PlayerProblem,
  Topic,
  MessageEvent,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import {
  IIterableSource,
  Initalization,
  MessageIteratorArgs,
  IteratorResult,
  GetBackfillMessagesArgs,
} from "../IIterableSource";
import streamMessages, { ParsedChannelAndEncodings } from "./streamMessages";

const log = Logger.getLogger(__filename);

type DataPlatformIterableSourceOptions = {
  api: ConsoleApi;
  deviceId: string;
  start: Time;
  end: Time;
};

export class DataPlatformIterableSource implements IIterableSource {
  private readonly _consoleApi: ConsoleApi;

  private _start: Time;
  private _end: Time;
  private _deviceId: string;
  private _knownTopicNames: string[] = [];

  /**
   * Cached readers for each schema so we don't have to re-parse definitions on each stream request.
   * Although each topic is usually homogeneous, technically it is possible to have different
   * encoding or schema for each topic, so we store all the ones we've seen.
   */
  private _parsedChannelsByTopic = new Map<string, ParsedChannelAndEncodings[]>();

  public constructor(options: DataPlatformIterableSourceOptions) {
    this._consoleApi = options.api;
    this._start = options.start;
    this._end = options.end;
    this._deviceId = options.deviceId;
  }

  public async initialize(): Promise<Initalization> {
    const [coverage, rawTopics] = await Promise.all([
      this._consoleApi.coverage({
        deviceId: this._deviceId,
        start: toRFC3339String(this._start),
        end: toRFC3339String(this._end),
      }),
      this._consoleApi.topics({
        deviceId: this._deviceId,
        start: toRFC3339String(this._start),
        end: toRFC3339String(this._end),
        includeSchemas: true,
      }),
    ]);
    if (rawTopics.length === 0 || coverage.length === 0) {
      throw new Error(
        `No data available for ${this._deviceId} between ${formatTimeRaw(
          this._start,
        )} and ${formatTimeRaw(this._end)}.`,
      );
    }

    // Truncate start/end time to coverage range
    const coverageStart = minBy(coverage, (c) => c.start);
    const coverageEnd = maxBy(coverage, (c) => c.end);
    const coverageStartTime = coverageStart ? fromRFC3339String(coverageStart.start) : undefined;
    const coverageEndTime = coverageEnd ? fromRFC3339String(coverageEnd.end) : undefined;
    if (!coverageStartTime || !coverageEndTime) {
      throw new Error(
        `Invalid coverage response, start: ${coverage[0]!.start}, end: ${
          coverage[coverage.length - 1]!.end
        }`,
      );
    }

    const device = await this._consoleApi.getDevice(this._deviceId);

    if (isLessThan(this._start, coverageStartTime)) {
      log.debug("Increased start time from", this._start, "to", coverageStartTime);
      this._start = coverageStartTime;
    }
    if (isGreaterThan(this._end, coverageEndTime)) {
      log.debug("Reduced end time from", this._end, "to", coverageEndTime);
      this._end = coverageEndTime;
    }

    const topics: Topic[] = [];
    const topicStats = new Map<string, TopicStats>();
    const datatypes: RosDatatypes = new Map();
    const problems: PlayerProblem[] = [];
    rawTopics: for (const rawTopic of rawTopics) {
      const { topic, encoding: messageEncoding, schemaEncoding, schema, schemaName } = rawTopic;
      if (schema == undefined) {
        problems.push({ message: `Missing schema for ${topic}`, severity: "error" });
        continue;
      }

      let parsedChannels = this._parsedChannelsByTopic.get(topic);
      if (!parsedChannels) {
        parsedChannels = [];
        this._parsedChannelsByTopic.set(topic, parsedChannels);
      }
      for (const info of parsedChannels) {
        if (
          info.messageEncoding === messageEncoding &&
          info.schemaEncoding === schemaEncoding &&
          isEqual(info.schema, schema)
        ) {
          continue rawTopics;
        }
      }

      const parsedChannel = parseChannel({
        messageEncoding,
        schema: { name: schemaName, data: schema, encoding: schemaEncoding },
      });

      topics.push({ name: topic, datatype: parsedChannel.fullSchemaName });
      parsedChannels.push({ messageEncoding, schemaEncoding, schema, parsedChannel });

      // Final datatypes is an unholy union of schemas across all channels
      for (const [name, datatype] of parsedChannel.datatypes) {
        datatypes.set(name, datatype);
      }
    }

    this._knownTopicNames = topics.map((topic) => topic.name);
    return {
      topics,
      topicStats,
      datatypes,
      start: this._start,
      end: this._end,
      profile: undefined,
      problems,
      publishersByTopic: new Map(),
      name: `${device.name} (${device.id})`,
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    const api = this._consoleApi;
    const deviceId = this._deviceId;
    const parsedChannelsByTopic = this._parsedChannelsByTopic;

    // Data platform treats topic array length 0 as "all topics". Until that is changed, we filter out
    // empty topic requests
    if (args.topics.length === 0) {
      return;
    }

    // If the topics available to us don't overlap with the topics we know about then we avoid
    // making any requests since there's no data to return
    const matchingTopics = args.topics.reduce((count, topicName) => {
      return this._knownTopicNames.includes(topicName) ? count + 1 : count;
    }, 0);
    if (matchingTopics === 0) {
      return;
    }

    const streamStart = args.start ?? this._start;
    const streamEnd = clampTime(args.end ?? this._end, this._start, this._end);

    const stream = streamMessages({
      api,
      parsedChannelsByTopic,
      params: { deviceId, start: streamStart, end: streamEnd, topics: args.topics },
    });

    for await (const messages of stream) {
      for (const message of messages) {
        yield { connectionId: undefined, msgEvent: message, problem: undefined };
      }
    }
  }

  public async getBackfillMessages({
    topics,
    time,
    abortSignal,
  }: GetBackfillMessagesArgs): Promise<MessageEvent<unknown>[]> {
    // Data platform treats topic array length 0 as "all topics". Until that is changed, we filter out
    // empty topic requests
    if (topics.length === 0) {
      return [];
    }

    const messages: MessageEvent<unknown>[] = [];
    for await (const block of streamMessages({
      api: this._consoleApi,
      parsedChannelsByTopic: this._parsedChannelsByTopic,
      signal: abortSignal,
      params: {
        deviceId: this._deviceId,
        start: time,
        end: time,
        topics,
        replayPolicy: "lastPerChannel",
        replayLookbackSeconds: 30 * 60,
      },
    })) {
      messages.push(...block);
    }
    return messages;
  }
}
