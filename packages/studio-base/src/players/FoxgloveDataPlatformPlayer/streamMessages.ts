// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { captureException } from "@sentry/core";
import { isEqual } from "lodash";

import Logger from "@foxglove/log";
import { Mcap0StreamReader, Mcap0Types } from "@foxglove/mcap";
import { loadDecompressHandlers, parseChannel, ParsedChannel } from "@foxglove/mcap-support";
import { fromNanoSec, isTimeInRangeInclusive, Time, toRFC3339String } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";

const log = Logger.getLogger(__filename);

/**
 * Information necessary to match a Channel & Schema record in the MCAP data to one that we received
 * from the /topics endpoint.
 */
export type ParsedChannelAndEncodings = {
  messageEncoding: string;
  schemaEncoding: string;
  schema: Uint8Array;
  parsedChannel: ParsedChannel;
};

export default async function* streamMessages({
  api,
  signal,
  parsedChannelsByTopic,
  params,
}: {
  api: ConsoleApi;

  /**
   * An AbortSignal allowing the stream request to be canceled. When the signal is aborted, the
   * function may return successfully (possibly after yielding any remaining messages), or it may
   * raise an AbortError.
   */
  signal: AbortSignal;

  /** Parameters indicating the time range to stream. */
  params: { deviceId: string; start: Time; end: Time; topics: readonly string[] };

  /**
   * Message readers are initialized out of band so we can parse message definitions only once.
   *
   * NOTE: If we encounter a channel/schema pair that is not pre-initialized, we will add it to
   * parsedChannelsByTopic (thus mutating parsedChannelsByTopic).
   */
  parsedChannelsByTopic: Map<string, ParsedChannelAndEncodings[]>;
}): AsyncIterable<MessageEvent<unknown>[]> {
  const decompressHandlers = await loadDecompressHandlers();

  log.debug("streamMessages", params);
  const startTimer = performance.now();
  const { link: mcapUrl } = await api.stream({
    deviceId: params.deviceId,
    start: toRFC3339String(params.start),
    end: toRFC3339String(params.end),
    topics: params.topics,
    outputFormat: "mcap0",
  });
  if (signal.aborted) {
    return;
  }
  const response = await fetch(mcapUrl, { signal });
  if (response.status === 404) {
    return;
  } else if (response.status !== 200) {
    log.error(`${response.status} response for`, mcapUrl, response);
    throw new Error(`Unexpected response status ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Unable to stream response body");
  }
  const streamReader = response.body.getReader();

  const schemasById = new Map<number, Mcap0Types.TypedMcapRecords["Schema"]>();
  const channelInfoById = new Map<
    number,
    { channel: Mcap0Types.TypedMcapRecords["Channel"]; parsedChannel: ParsedChannel }
  >();

  let totalMessages = 0;
  let messages: MessageEvent<unknown>[] = [];

  function processRecord(record: Mcap0Types.TypedMcapRecord) {
    switch (record.type) {
      default:
        return;

      case "Schema":
        schemasById.set(record.id, record);
        return;

      case "Channel": {
        if (channelInfoById.has(record.id)) {
          return;
        }
        if (record.schemaId === 0) {
          throw new Error(
            `Channel ${record.id} (topic ${record.topic}) has no schema; channels without schemas are not supported`,
          );
        }
        const schema = schemasById.get(record.schemaId);
        if (!schema) {
          throw new Error(
            `Missing schema info for schema id ${record.schemaId} (channel ${record.id}, topic ${record.topic})`,
          );
        }
        const parsedChannels = parsedChannelsByTopic.get(record.topic) ?? [];
        for (const info of parsedChannels) {
          if (
            info.messageEncoding === record.messageEncoding &&
            info.schemaEncoding === schema.encoding &&
            isEqual(info.schema, schema.data)
          ) {
            channelInfoById.set(record.id, { channel: record, parsedChannel: info.parsedChannel });
            return;
          }
        }

        // We've not found a previously parsed channel with matching schema
        // Create one here just-in-time
        const parsedChannel = parseChannel({
          messageEncoding: record.messageEncoding,
          schema,
        });

        parsedChannels.push({
          messageEncoding: record.messageEncoding,
          schemaEncoding: schema.encoding,
          schema: schema.data,
          parsedChannel,
        });

        parsedChannelsByTopic.set(record.topic, parsedChannels);

        channelInfoById.set(record.id, { channel: record, parsedChannel });

        const err = new Error(
          `No pre-initialized reader for ${record.topic} (message encoding ${record.messageEncoding}, schema encoding ${schema.encoding}, schema name ${schema.name})`,
        );
        captureException(err);
        return;
      }

      case "Message": {
        const info = channelInfoById.get(record.channelId);
        if (!info) {
          throw new Error(`message for channel ${record.channelId} with no prior channel/schema`);
        }
        const receiveTime = fromNanoSec(record.logTime);
        if (isTimeInRangeInclusive(receiveTime, params.start, params.end)) {
          totalMessages++;
          messages.push({
            topic: info.channel.topic,
            receiveTime,
            message: info.parsedChannel.deserializer(record.data),
            sizeInBytes: record.data.byteLength,
          });
        }
        return;
      }
    }
  }

  const reader = new Mcap0StreamReader({ decompressHandlers });
  for (let result; (result = await streamReader.read()), !result.done; ) {
    reader.append(result.value);
    for (let record; (record = reader.nextRecord()); ) {
      processRecord(record);
    }
    if (messages.length > 0) {
      yield messages;
      messages = [];
    }
  }
  if (!reader.done()) {
    throw new Error("Incomplete mcap file");
  }

  log.debug(
    "Streamed",
    totalMessages,
    "messages",
    messages,
    "in",
    `${performance.now() - startTimer}ms`,
  );
}
