// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import decompressLZ4 from "wasm-lz4";

import { McapReader, McapRecord } from "@foxglove/mcap";
import { Bag } from "@foxglove/rosbag";
import { BlobReader } from "@foxglove/rosbag/web";
import { Time, fromNanoSec, isLessThan, isGreaterThan } from "@foxglove/rostime";

export type TopicInfo = {
  topic: string;
  datatype: string;
  numMessages: number;
  numConnections: number;
};

export type FileInfo = {
  numChunks: number;
  totalMessages: number;
  startTime: Time | undefined;
  endTime: Time | undefined;
  topics: TopicInfo[];
};

export async function getBagInfo(file: File): Promise<FileInfo> {
  const bag = new Bag(new BlobReader(file));
  await bag.open();
  const numMessagesByConnectionIndex = Array.from(bag.connections.values(), () => 0);
  let totalMessages = 0;
  for (const chunk of bag.chunkInfos) {
    for (const { conn, count } of chunk.connections) {
      numMessagesByConnectionIndex[conn] += count;
      totalMessages += count;
    }
  }

  const topicInfosByTopic = new Map<string, TopicInfo>();
  for (const { topic, type: datatype, conn } of bag.connections.values()) {
    const info = topicInfosByTopic.get(topic);
    if (info != undefined) {
      if (info.datatype !== datatype) {
        info.datatype = "(multiple)";
      }
      info.numMessages += numMessagesByConnectionIndex[conn] ?? 0;
      info.numConnections++;
    } else {
      topicInfosByTopic.set(topic, {
        topic,
        datatype: datatype ?? "(unknown)",
        numMessages: numMessagesByConnectionIndex[conn] ?? 0,
        numConnections: 1,
      });
    }
  }
  const topics = [...topicInfosByTopic.values()].sort((a, b) => a.topic.localeCompare(b.topic));
  return {
    totalMessages,
    numChunks: bag.chunkInfos.length,
    startTime: bag.startTime ?? undefined,
    endTime: bag.endTime ?? undefined,
    topics,
  };
}

export async function getMcapInfo(file: File): Promise<FileInfo> {
  const reader = new McapReader({
    includeChunks: true,
    validateChunkCrcs: false,
    decompressHandlers: {
      lz4: (buffer, decompressedSize) => decompressLZ4(buffer, Number(decompressedSize)),
    },
  });

  let totalMessages = 0;
  let numChunks = 0;
  let startTime: Time | undefined;
  let endTime: Time | undefined;
  const topicInfosByTopic = new Map<string, TopicInfo & { connectionIds: Set<number> }>();

  function processRecord(record: McapRecord) {
    switch (record.type) {
      default:
        return;

      case "Chunk":
        numChunks++;
        return;

      case "ChannelInfo": {
        const info = topicInfosByTopic.get(record.topic);
        if (info != undefined) {
          if (info.datatype !== record.schemaName) {
            info.datatype = "(multiple)";
          }
          if (!info.connectionIds.has(record.id)) {
            info.connectionIds.add(record.id);
            info.numConnections++;
          }
        } else {
          topicInfosByTopic.set(record.topic, {
            topic: record.topic,
            datatype: record.schemaName,
            numMessages: 0,
            numConnections: 1,
            connectionIds: new Set([record.id]),
          });
        }
        return;
      }

      case "Message": {
        const info = topicInfosByTopic.get(record.channelInfo.topic);
        if (info != undefined) {
          info.numMessages++;
        }
        totalMessages++;
        const timestamp = fromNanoSec(record.timestamp);
        if (!startTime || isLessThan(timestamp, startTime)) {
          startTime = timestamp;
        }
        if (!endTime || isGreaterThan(timestamp, endTime)) {
          endTime = timestamp;
        }
        return;
      }
    }
  }

  const streamReader = file.stream().getReader();
  for (let result; (result = await streamReader.read()), !result.done; ) {
    reader.append(result.value);
    for (let record; (record = reader.nextRecord()); ) {
      processRecord(record);
    }
  }

  const topics = [...topicInfosByTopic.values()].sort((a, b) => a.topic.localeCompare(b.topic));
  return {
    totalMessages,
    numChunks,
    startTime,
    endTime,
    topics,
  };
}
