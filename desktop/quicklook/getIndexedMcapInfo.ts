// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mcap0IndexedReader, Mcap0Types } from "@mcap/core";

import { fromNanoSec } from "@foxglove/rostime";

import { FileInfo, TopicInfo } from "./types";

export default async function getIndexedMcapInfo(
  file: File,
  decompressHandlers: Mcap0Types.DecompressHandlers,
): Promise<FileInfo> {
  const reader = await Mcap0IndexedReader.Initialize({
    readable: {
      size: async () => BigInt(file.size),
      read: async (offset, length) => {
        if (offset + length > Number.MAX_SAFE_INTEGER) {
          throw new Error(`Read too large: offset ${offset}, length ${length}`);
        }
        const buffer = await file.slice(Number(offset), Number(offset + length)).arrayBuffer();
        return new Uint8Array(buffer);
      },
    },
    decompressHandlers,
  });

  let hasMissingSchemas = false;
  for (const channel of reader.channelsById.values()) {
    if (channel.schemaId !== 0 && !reader.schemasById.has(channel.schemaId)) {
      hasMissingSchemas = true;
      break;
    }
  }
  if (reader.channelsById.size === 0 || hasMissingSchemas) {
    throw new Error(
      "MCAP summary does not contain channels or schemas, cannot use indexed reading",
    );
  }

  const topicInfosByTopic = new Map<string, TopicInfo>();
  for (const channel of reader.channelsById.values()) {
    const info = topicInfosByTopic.get(channel.topic);
    const schema = reader.schemasById.get(channel.schemaId);
    const numMessages = reader.statistics?.channelMessageCounts.get(channel.id);
    if (info != undefined) {
      if (schema != undefined && info.schemaName !== schema.name) {
        info.schemaName = "(multiple)";
      }
      if (numMessages != undefined) {
        info.numMessages = (info.numMessages ?? 0n) + numMessages;
      }
      info.numConnections++;
    } else {
      topicInfosByTopic.set(channel.topic, {
        topic: channel.topic,
        schemaName: schema?.name ?? "(unknown)",
        numMessages,
        numConnections: 1,
      });
    }
  }
  const topics = [...topicInfosByTopic.values()].sort((a, b) => a.topic.localeCompare(b.topic));

  let startTime: bigint | undefined;
  let endTime: bigint | undefined;
  const compressionTypes = new Set<string>();
  for (const chunk of reader.chunkIndexes) {
    compressionTypes.add(chunk.compression);
    if (startTime == undefined || chunk.messageStartTime < startTime) {
      startTime = chunk.messageStartTime;
    }
    if (endTime == undefined || chunk.messageEndTime > endTime) {
      endTime = chunk.messageEndTime;
    }
  }
  return {
    fileType: "MCAP v0, indexed",
    numChunks: reader.chunkIndexes.length,
    numAttachments: reader.attachmentIndexes.length,
    totalMessages: reader.statistics?.messageCount,
    startTime: startTime != undefined ? fromNanoSec(startTime) : undefined,
    endTime: endTime != undefined ? fromNanoSec(endTime) : undefined,
    topics,
    compressionTypes,
  };
}
