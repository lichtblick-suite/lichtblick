// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual } from "lodash";
import decompressLZ4 from "wasm-lz4";

import Logger from "@foxglove/log";
import { ChannelInfo, McapReader, McapRecord } from "@foxglove/mcap";
import { parse as parseMessageDefinition, RosMsgDefinition } from "@foxglove/rosmsg";
import { LazyMessageReader } from "@foxglove/rosmsg-serialization";
import { MessageReader as ROS2MessageReader } from "@foxglove/rosmsg2-serialization";
import { fromNanoSec, isTimeInRangeInclusive, Time, toRFC3339String } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";

const log = Logger.getLogger(__filename);

export default async function* streamMessages(
  api: ConsoleApi,
  signal: AbortSignal,
  params: { deviceId: string; start: Time; end: Time; topics: readonly string[] },
): AsyncIterable<MessageEvent<unknown>[]> {
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
    throw new Error(`Unexpected response status ${response.status} for ${mcapUrl}`);
  }
  if (!response.body) {
    throw new Error("Unable to stream response body");
  }
  const streamReader = response.body?.getReader();

  const channelInfoById = new Map<
    number,
    {
      info: ChannelInfo;
      messageDeserializer: ROS2MessageReader | LazyMessageReader;
      parsedDefinitions: RosMsgDefinition[];
    }
  >();

  let totalMessages = 0;
  let messages: MessageEvent<unknown>[] = [];

  function processRecord(record: McapRecord) {
    switch (record.type) {
      default:
        break;

      case "ChannelInfo": {
        const existingInfo = channelInfoById.get(record.id);
        if (existingInfo) {
          if (!isEqual(existingInfo.info, record)) {
            throw new Error(`differing channel infos for for ${record.id}`);
          }
          break;
        }
        let parsedDefinitions;
        let messageDeserializer;
        if (record.encoding === "ros1") {
          parsedDefinitions = parseMessageDefinition(new TextDecoder().decode(record.schema));
          messageDeserializer = new LazyMessageReader(parsedDefinitions);
        } else if (record.encoding === "ros2") {
          parsedDefinitions = parseMessageDefinition(new TextDecoder().decode(record.schema), {
            ros2: true,
          });
          messageDeserializer = new ROS2MessageReader(parsedDefinitions);
        } else {
          throw new Error(`unsupported encoding ${record.encoding}`);
        }
        channelInfoById.set(record.id, { info: record, messageDeserializer, parsedDefinitions });
        break;
      }

      case "Message": {
        const channelInfo = channelInfoById.get(record.channelId);
        if (!channelInfo) {
          throw new Error(`message for channel ${record.channelId} with no prior channel info`);
        }
        const receiveTime = fromNanoSec(record.timestamp);
        if (isTimeInRangeInclusive(receiveTime, params.start, params.end)) {
          totalMessages++;
          messages.push({
            topic: channelInfo.info.topic,
            receiveTime,
            message: channelInfo.messageDeserializer.readMessage(new DataView(record.data)),
          });
        }
        break;
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
