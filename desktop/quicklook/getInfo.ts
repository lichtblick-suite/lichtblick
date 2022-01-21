// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import decompressLZ4 from "wasm-lz4";

import Logger from "@foxglove/log";
import {
  Mcap0IndexedReader,
  Mcap0StreamReader,
  McapPre0To0StreamReader,
  Mcap0Types,
  detectVersion,
  DETECT_VERSION_BYTES_REQUIRED,
} from "@foxglove/mcap";
import { Bag } from "@foxglove/rosbag";
import { BlobReader } from "@foxglove/rosbag/web";
import { Time, fromNanoSec, isLessThan, isGreaterThan } from "@foxglove/rostime";

const log = Logger.getLogger(__filename);

export type TopicInfo = {
  topic: string;
  datatype: string;
  numMessages: bigint;
  numConnections: number;
};

export type FileInfo = {
  loadMoreInfo?: (reportProgress: (progress: number) => void) => Promise<FileInfo>;
  fileType?: string | undefined;
  numChunks?: number;
  numAttachments?: number;
  totalMessages?: bigint;
  startTime?: Time | undefined;
  endTime?: Time | undefined;
  topics?: TopicInfo[];
  compressionTypes?: string[];
};

export async function getBagInfo(file: File): Promise<FileInfo> {
  const bag = new Bag(new BlobReader(file));
  await bag.open();
  const numMessagesByConnectionIndex = Array.from(bag.connections.values(), () => 0n);
  let totalMessages = 0n;
  for (const chunk of bag.chunkInfos) {
    for (const { conn, count } of chunk.connections) {
      numMessagesByConnectionIndex[conn] += BigInt(count);
      totalMessages += BigInt(count);
    }
  }

  const topicInfosByTopic = new Map<string, TopicInfo>();
  for (const { topic, type: datatype, conn } of bag.connections.values()) {
    const info = topicInfosByTopic.get(topic);
    if (info != undefined) {
      if (info.datatype !== datatype) {
        info.datatype = "(multiple)";
      }
      info.numMessages += numMessagesByConnectionIndex[conn] ?? 0n;
      info.numConnections++;
    } else {
      topicInfosByTopic.set(topic, {
        topic,
        datatype: datatype ?? "(unknown)",
        numMessages: numMessagesByConnectionIndex[conn] ?? 0n,
        numConnections: 1,
      });
    }
  }
  const topics = [...topicInfosByTopic.values()].sort((a, b) => a.topic.localeCompare(b.topic));
  return {
    fileType: undefined,
    totalMessages,
    numChunks: bag.chunkInfos.length,
    startTime: bag.startTime ?? undefined,
    endTime: bag.endTime ?? undefined,
    topics,
  };
}

export async function getMcapInfo(file: File): Promise<FileInfo> {
  const mcapVersion = detectVersion(
    new DataView(await file.slice(0, DETECT_VERSION_BYTES_REQUIRED).arrayBuffer()),
  );

  const decompressHandlers: Mcap0Types.DecompressHandlers = {
    lz4: (buffer, decompressedSize) => decompressLZ4(buffer, Number(decompressedSize)),
  };
  switch (mcapVersion) {
    case undefined:
      throw new Error("Not a valid MCAP file");
    case "0":
      // Try indexed read
      try {
        return await getIndexedMcapInfo(file, decompressHandlers);
      } catch (error) {
        log.info("Failed to read MCAP file as indexed:", error);
      }

      return {
        fileType: "MCAP v0, unindexed",
        loadMoreInfo: async (reportProgress) =>
          await getStreamedMcapInfo(
            file,
            new Mcap0StreamReader({
              includeChunks: true,
              decompressHandlers,
              validateCrcs: true,
            }),
            "MCAP v0, unindexed",
            reportProgress,
          ),
      };

    case "pre0":
      return {
        fileType: "MCAP pre-v0",
        loadMoreInfo: async (reportProgress) =>
          await getStreamedMcapInfo(
            file,
            new McapPre0To0StreamReader({
              includeChunks: true,
              validateChunkCrcs: false,
              decompressHandlers,
            }),
            "MCAP pre-v0",
            reportProgress,
          ),
      };
  }
}

async function getIndexedMcapInfo(file: File, decompressHandlers: Mcap0Types.DecompressHandlers) {
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

  const topicInfosByTopic = new Map<string, TopicInfo>();
  for (const channel of reader.channelInfosById.values()) {
    const info = topicInfosByTopic.get(channel.topicName);
    if (info != undefined) {
      if (info.datatype !== channel.schemaName) {
        info.datatype = "(multiple)";
      }
      info.numMessages += reader.statistics?.channelMessageCounts.get(channel.channelId) ?? 0n;
      info.numConnections++;
    } else {
      topicInfosByTopic.set(channel.topicName, {
        topic: channel.topicName,
        datatype: channel.schemaName ?? "(unknown)",
        numMessages: reader.statistics?.channelMessageCounts.get(channel.channelId) ?? 0n,
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
    if (startTime == undefined || chunk.startTime < startTime) {
      startTime = chunk.startTime;
    }
    if (endTime == undefined || chunk.endTime > endTime) {
      endTime = chunk.endTime;
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
    compressionTypes: Array.from(compressionTypes).sort((a, b) => a.localeCompare(b)),
  };
}

async function getStreamedMcapInfo(
  file: File,
  mcapStreamReader: Mcap0Types.McapStreamReader,
  fileType: string,
  reportProgress: (progress: number) => void,
): Promise<FileInfo> {
  let totalMessages = 0n;
  let numChunks = 0;
  let numAttachments = 0;
  let startTime: Time | undefined;
  let endTime: Time | undefined;
  const compressionTypes = new Set<string>();
  const topicInfosByTopic = new Map<string, TopicInfo & { connectionIds: Set<number> }>();
  const channelInfosById = new Map<number, Mcap0Types.TypedMcapRecords["ChannelInfo"]>();

  function processRecord(record: Mcap0Types.TypedMcapRecord) {
    switch (record.type) {
      case "Chunk":
        numChunks++;
        compressionTypes.add(record.compression);
        return;

      case "Attachment":
        numAttachments++;
        break;

      case "ChannelInfo": {
        channelInfosById.set(record.channelId, record);
        const info = topicInfosByTopic.get(record.topicName);
        if (info != undefined) {
          if (info.datatype !== record.schemaName) {
            info.datatype = "(multiple)";
          }
          if (!info.connectionIds.has(record.channelId)) {
            info.connectionIds.add(record.channelId);
            info.numConnections++;
          }
        } else {
          topicInfosByTopic.set(record.topicName, {
            topic: record.topicName,
            datatype: record.schemaName,
            numMessages: 0n,
            numConnections: 1,
            connectionIds: new Set([record.channelId]),
          });
        }
        return;
      }

      case "Message": {
        const channel = channelInfosById.get(record.channelId);
        if (channel) {
          const info = topicInfosByTopic.get(channel.topicName);
          if (info != undefined) {
            info.numMessages++;
          }
        }
        totalMessages++;
        const timestamp = fromNanoSec(record.recordTime);
        if (!startTime || isLessThan(timestamp, startTime)) {
          startTime = timestamp;
        }
        if (!endTime || isGreaterThan(timestamp, endTime)) {
          endTime = timestamp;
        }
        return;
      }

      case "AttachmentIndex":
      case "Statistics":
      case "Unknown":
      case "Header":
      case "Footer":
      case "MessageIndex":
      case "ChunkIndex":
        break;
    }
  }

  // Use file.slice() rather than file.stream().getReader().read() because the latter has terrible
  // performance in Safari (~50x slower than Chrome).
  const chunkSize = 1024 * 1024;
  let bytesRead = 0;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
    mcapStreamReader.append(new Uint8Array(buffer));
    for (let record; (record = mcapStreamReader.nextRecord()); ) {
      processRecord(record);
    }
    bytesRead += buffer.byteLength;
    reportProgress(bytesRead / file.size);
  }

  const topics = [...topicInfosByTopic.values()].sort((a, b) => a.topic.localeCompare(b.topic));
  return {
    fileType,
    numChunks,
    numAttachments,
    totalMessages,
    startTime,
    endTime,
    topics,
    compressionTypes: Array.from(compressionTypes).sort((a, b) => a.localeCompare(b)),
  };
}
