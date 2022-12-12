// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { captureException } from "@sentry/core";
import { isEqual, maxBy, minBy } from "lodash";

import Logger from "@foxglove/log";
import { parseChannel } from "@foxglove/mcap-support";
import {
  clampTime,
  fromRFC3339String,
  isGreaterThan,
  isLessThan,
  add as addTime,
  compare,
  Time,
} from "@foxglove/rostime";
import {
  PlayerProblem,
  Topic,
  MessageEvent,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import ConsoleApi, { CoverageResponse } from "@foxglove/studio-base/services/ConsoleApi";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import {
  IIterableSource,
  Initalization,
  MessageIteratorArgs,
  IteratorResult,
  GetBackfillMessagesArgs,
  IterableSourceInitializeArgs,
} from "../IIterableSource";
import { streamMessages, ParsedChannelAndEncodings, StreamParams } from "./streamMessages";

const log = Logger.getLogger(__filename);

/**
 * The console api methods used by DataPlatformIterableSource.
 *
 * This scopes the required interface to a small subset of ConsoleApi to make it easier to mock/stub
 * for tests.
 */
export type DataPlatformInterableSourceConsoleApi = Pick<
  ConsoleApi,
  "coverage" | "topics" | "getDevice" | "stream"
>;

type DataPlatformSourceParameters =
  | { type: "by-device"; deviceId: string; start: Time; end: Time }
  | { type: "by-import"; importId: string; start?: Time; end?: Time };

type DataPlatformIterableSourceOptions = {
  api: DataPlatformInterableSourceConsoleApi;
  params: DataPlatformSourceParameters;
};

export class DataPlatformIterableSource implements IIterableSource {
  private readonly _consoleApi: DataPlatformInterableSourceConsoleApi;

  private _knownTopicNames: string[] = [];
  private _params: DataPlatformSourceParameters;

  /**
   * Cached readers for each schema so we don't have to re-parse definitions on each stream request.
   * Although each topic is usually homogeneous, technically it is possible to have different
   * encoding or schema for each topic, so we store all the ones we've seen.
   */
  private _parsedChannelsByTopic = new Map<string, ParsedChannelAndEncodings[]>();

  private _coverage: CoverageResponse[] = [];

  public constructor(options: DataPlatformIterableSourceOptions) {
    this._consoleApi = options.api;
    this._params = options.params;
  }

  public async initialize(): Promise<Initalization> {
    const params = this._params;

    const apiParams =
      params.type === "by-device"
        ? {
            deviceId: params.deviceId,
            start: params.start,
            end: params.end,
          }
        : {
            importId: params.importId,
            start: params.start,
            end: params.end,
          };

    const [coverage, rawTopics] = await Promise.all([
      this._consoleApi.coverage(apiParams),
      this._consoleApi.topics({ ...apiParams, includeSchemas: true }),
    ]);

    if (rawTopics.length === 0 || coverage.length === 0) {
      throw new Error(
        params.type === "by-device"
          ? `No data available for ${params.deviceId} between ${formatTimeRaw(
              params.start,
            )} and ${formatTimeRaw(params.end)}.`
          : `No data available for ${params.importId}`,
      );
    }

    this._coverage = coverage;

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

    const device = await this._consoleApi.getDevice(
      params.type === "by-device" ? params.deviceId : coverageStart?.deviceId ?? "",
    );

    if (!params.start || isLessThan(params.start, coverageStartTime)) {
      log.debug("Increased start time from", params.start, "to", coverageStartTime);
      params.start = coverageStartTime;
    }
    if (!params.end || isGreaterThan(params.end, coverageEndTime)) {
      log.debug("Reduced end time from", params.end, "to", coverageEndTime);
      params.end = coverageEndTime;
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

      try {
        const parsedChannel = parseChannel({
          messageEncoding,
          schema: { name: schemaName, data: schema, encoding: schemaEncoding },
        });

        topics.push({ name: topic, schemaName });
        parsedChannels.push({ messageEncoding, schemaEncoding, schema, parsedChannel });

        // Final datatypes is an unholy union of schemas across all channels
        for (const [name, datatype] of parsedChannel.datatypes) {
          datatypes.set(name, datatype);
        }
      } catch (err) {
        captureException(err, { extra: { rawTopic } });
        problems.push({
          message: `Failed to parse schema for topic ${topic}`,
          severity: "error",
          error: err,
        });
      }
    }

    let profile: string | undefined;

    // Workaround for https://github.com/foxglove/studio/issues/4690.
    // If all topics use ros1/2 schemas and message encodings, assume we are working with the ros1/2 profile data.
    if (
      rawTopics.length > 0 &&
      rawTopics.every((topic) => topic.encoding === "ros1" && topic.schemaEncoding === "ros1msg")
    ) {
      profile = "ros1";
    } else if (
      rawTopics.length > 0 &&
      rawTopics.every(
        (topic) =>
          topic.encoding === "cdr" &&
          (topic.schemaEncoding === "ros2msg" || topic.schemaEncoding === "ros2idl"),
      )
    ) {
      profile = "ros2";
    }

    this._knownTopicNames = topics.map((topic) => topic.name);
    return {
      topics,
      topicStats,
      datatypes,
      start: params.start,
      end: params.end,
      profile,
      problems,
      publishersByTopic: new Map(),
      name: `${device.name} (${device.id})`,
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    log.debug("message iterator", args);

    const api = this._consoleApi;
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
      log.debug("no matching topics to stream");
      return;
    }

    if (!this._params.start || !this._params.end) {
      log.debug("source needs to be initialized");
      return;
    }

    const streamStart = args.start ?? this._params.start;
    const streamEnd = clampTime(args.end ?? this._params.end, this._params.start, this._params.end);

    if (args.consumptionType === "full") {
      const streamByParams: StreamParams =
        this._params.type === "by-device"
          ? {
              deviceId: this._params.deviceId,
              topics: args.topics,
              start: streamStart,
              end: streamEnd,
            }
          : {
              importId: this._params.importId,
              topics: args.topics,
              start: streamStart,
              end: streamEnd,
            };

      const stream = streamMessages({
        api,
        parsedChannelsByTopic,
        params: streamByParams,
      });

      for await (const messages of stream) {
        for (const message of messages) {
          yield { type: "message-event", msgEvent: message };
        }
      }

      return;
    }

    let localStart = streamStart;
    let localEnd = clampTime(addTime(localStart, { sec: 5, nsec: 0 }), streamStart, streamEnd);

    for (;;) {
      const streamByParams: StreamParams =
        this._params.type === "by-device"
          ? {
              deviceId: this._params.deviceId,
              topics: args.topics,
              start: localStart,
              end: localEnd,
            }
          : {
              importId: this._params.importId,
              topics: args.topics,
              start: localStart,
              end: localEnd,
            };

      const stream = streamMessages({
        api,
        parsedChannelsByTopic,
        params: streamByParams,
      });

      for await (const messages of stream) {
        for (const message of messages) {
          yield { type: "message-event", msgEvent: message };
        }
      }

      if (compare(localEnd, streamEnd) >= 0) {
        return;
      }

      yield { type: "stamp", stamp: localEnd };

      localStart = addTime(localEnd, { sec: 0, nsec: 1 });

      // Assumes coverage regions are sorted by start time
      for (const coverage of this._coverage) {
        const end = fromRFC3339String(coverage.end);
        const start = fromRFC3339String(coverage.start);
        if (!start || !end) {
          continue;
        }

        // if localStart is in a coverage region, then allow this localStart to be used
        if (compare(localStart, start) >= 0 && compare(localStart, end) <= 0) {
          break;
        }

        // if localStart is completely before a coverage region then we reset the localStart to the
        // start of the coverage region. Since coverage regions are sorted by start time, if we get
        // here we know that localStart did not fall into a previous coverage region
        if (compare(localStart, end) <= 0 && compare(localStart, start) < 0) {
          localStart = start;
          log.debug("start is in a coverage gap, adjusting start to next coverage range", start);
          break;
        }
      }

      localStart = clampTime(localStart, streamStart, streamEnd);
      localEnd = clampTime(addTime(localStart, { sec: 5, nsec: 0 }), streamStart, streamEnd);
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

    const streamByParams: StreamParams =
      this._params.type === "by-device"
        ? {
            deviceId: this._params.deviceId,
            topics,
            start: time,
            end: time,
          }
        : {
            importId: this._params.importId,
            topics,
            start: time,
            end: time,
          };

    streamByParams.replayPolicy = "lastPerChannel";
    streamByParams.replayLookbackSeconds = 30 * 60;

    const messages: MessageEvent<unknown>[] = [];
    for await (const block of streamMessages({
      api: this._consoleApi,
      parsedChannelsByTopic: this._parsedChannelsByTopic,
      signal: abortSignal,
      params: streamByParams,
    })) {
      messages.push(...block);
    }
    return messages;
  }
}

export function initialize(args: IterableSourceInitializeArgs): DataPlatformIterableSource {
  const { api, params } = args;
  if (!params) {
    throw new Error("params is required for data platform source");
  }

  if (!api) {
    throw new Error("api is required for data platfomr");
  }

  const start = params.start;
  const end = params.end;
  const deviceId = params.deviceId;
  const importId = params.importId;

  const startTime = start ? fromRFC3339String(start) : undefined;
  const endTime = end ? fromRFC3339String(end) : undefined;

  if (!(importId || (deviceId && startTime && endTime))) {
    throw new Error("invalid args");
  }

  const dpSourceParams: DataPlatformSourceParameters = importId
    ? { type: "by-import", importId, start: startTime, end: endTime }
    : { type: "by-device", deviceId: deviceId!, start: startTime!, end: endTime! };

  const consoleApi = new ConsoleApi(api.baseUrl);
  if (api.auth) {
    consoleApi.setAuthHeader(api.auth);
  }

  return new DataPlatformIterableSource({
    api: consoleApi,
    params: dpSourceParams,
  });
}
