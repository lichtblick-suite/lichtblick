// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import decompressLZ4 from "wasm-lz4";

import Logger from "@foxglove/log";
import { McapReader, McapRecord } from "@foxglove/mcap";
import { fromNanoSec, isTimeInRangeInclusive, Time, toRFC3339String } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";

const log = Logger.getLogger(__filename);

interface MessageReader {
  readMessage(data: ArrayBufferView): MessageEvent<unknown>;
}

export default async function* streamMessages({
  api,
  signal,
  messageReadersByTopic,
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
   */
  messageReadersByTopic: Map<string, { encoding: string; schema: string; reader: MessageReader }[]>;
}): AsyncIterable<MessageEvent<unknown>[]> {
  await decompressLZ4.isLoaded;

  log.debug("streamMessages", params);
  const startTimer = performance.now();
  const { link: mcapUrl } = await api.stream({
    deviceId: params.deviceId,
    start: toRFC3339String(params.start),
    end: toRFC3339String(params.end),
    topics: params.topics,
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
  const streamReader = response.body?.getReader();

  const messageReadersByChannelId = new Map<number, MessageReader>();

  let totalMessages = 0;
  let messages: MessageEvent<unknown>[] = [];

  function processRecord(record: McapRecord) {
    switch (record.type) {
      default:
        return;

      case "ChannelInfo": {
        if (messageReadersByChannelId.has(record.id)) {
          return;
        }
        const readers = messageReadersByTopic.get(record.topic) ?? [];
        for (const reader of readers) {
          if (reader.encoding === record.encoding && reader.schema === record.schema) {
            messageReadersByChannelId.set(record.id, reader.reader);
            return;
          }
        }
        log.error("No pre-initialized reader for", record, "available readers are:", readers);
        throw new Error(
          `No pre-initialized reader for ${record.topic} (${record.encoding}, ${record.schemaName})`,
        );
      }

      case "Message": {
        const reader = messageReadersByChannelId.get(record.channelInfo.id);
        if (!reader) {
          throw new Error(
            `message for channel ${record.channelInfo.id} with no prior channel info`,
          );
        }
        const receiveTime = fromNanoSec(record.timestamp);
        if (isTimeInRangeInclusive(receiveTime, params.start, params.end)) {
          totalMessages++;
          messages.push({
            topic: record.channelInfo.topic,
            receiveTime,
            message: reader.readMessage(new DataView(record.data)),
          });
        }
        return;
      }
    }
  }

  const reader = new McapReader({
    decompressHandlers: {
      lz4: (buffer, decompressedSize) => decompressLZ4(buffer, Number(decompressedSize)),
    },
  });
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
