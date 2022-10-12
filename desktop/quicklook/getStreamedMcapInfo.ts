// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mcap0Types, McapPre0Types } from "@mcap/core";

import { Time, fromNanoSec, isLessThan, isGreaterThan } from "@foxglove/rostime";

import { TopicInfo, FileInfo } from "./types";

type McapInfo = {
  totalMessages: bigint;
  numChunks: number;
  numAttachments: number;
  startTime: Time | undefined;
  endTime: Time | undefined;
  compressionTypes: Set<string>;
  topicInfosByTopic: Map<string, TopicInfo & { connectionIds: Set<number> }>;
  topicNamesByChannelId: Map<number, string>;
  schemaNamesById: Map<number, string>;
};

export function processMcapPre0Record(info: McapInfo, record: McapPre0Types.McapRecord): void {
  switch (record.type) {
    case "Chunk":
      info.numChunks++;
      info.compressionTypes.add(record.compression);
      return;

    case "ChannelInfo": {
      info.topicNamesByChannelId.set(record.id, record.topic);
      const chanInfo = info.topicInfosByTopic.get(record.topic);
      if (chanInfo != undefined) {
        if (chanInfo.schemaName !== record.schemaName) {
          chanInfo.schemaName = "(multiple)";
        }
        if (!chanInfo.connectionIds.has(record.id)) {
          chanInfo.connectionIds.add(record.id);
          chanInfo.numConnections++;
        }
      } else {
        info.topicInfosByTopic.set(record.topic, {
          topic: record.topic,
          schemaName: record.schemaName,
          numMessages: 0n,
          numConnections: 1,
          connectionIds: new Set([record.id]),
        });
      }
      return;
    }

    case "Message": {
      const topic = record.channelInfo.topic;
      const topicInfo = info.topicInfosByTopic.get(topic);
      if (topicInfo != undefined) {
        topicInfo.numMessages = (topicInfo.numMessages ?? 0n) + 1n;
      }

      info.totalMessages++;
      const timestamp = fromNanoSec(record.timestamp);
      if (!info.startTime || isLessThan(timestamp, info.startTime)) {
        info.startTime = timestamp;
      }
      if (!info.endTime || isGreaterThan(timestamp, info.endTime)) {
        info.endTime = timestamp;
      }
      return;
    }

    case "Footer":
      break;
  }
}

export function processMcap0Record(info: McapInfo, record: Mcap0Types.TypedMcapRecord): void {
  switch (record.type) {
    case "Chunk":
      info.numChunks++;
      info.compressionTypes.add(record.compression);
      return;

    case "Attachment":
      info.numAttachments++;
      break;

    case "Schema":
      info.schemaNamesById.set(record.id, record.name);
      break;

    case "Channel": {
      info.topicNamesByChannelId.set(record.id, record.topic);
      const chanInfo = info.topicInfosByTopic.get(record.topic);
      const schemaName = info.schemaNamesById.get(record.schemaId);
      if (chanInfo != undefined) {
        if (schemaName != undefined && chanInfo.schemaName !== schemaName) {
          chanInfo.schemaName = "(multiple)";
        }
        if (!chanInfo.connectionIds.has(record.id)) {
          chanInfo.connectionIds.add(record.id);
          chanInfo.numConnections++;
        }
      } else {
        info.topicInfosByTopic.set(record.topic, {
          topic: record.topic,
          schemaName: schemaName ?? "(unknown)",
          numMessages: 0n,
          numConnections: 1,
          connectionIds: new Set([record.id]),
        });
      }
      return;
    }

    case "Message": {
      const topic = info.topicNamesByChannelId.get(record.channelId);
      if (topic != undefined) {
        const topicInfo = info.topicInfosByTopic.get(topic);
        if (topicInfo != undefined) {
          topicInfo.numMessages = (topicInfo.numMessages ?? 0n) + 1n;
        }
      }
      info.totalMessages++;
      const timestamp = fromNanoSec(record.logTime);
      if (!info.startTime || isLessThan(timestamp, info.startTime)) {
        info.startTime = timestamp;
      }
      if (!info.endTime || isGreaterThan(timestamp, info.endTime)) {
        info.endTime = timestamp;
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
    case "Metadata":
    case "MetadataIndex":
    case "SummaryOffset":
    case "DataEnd":
      break;
  }
}

interface GenericMcapStreamReader<R> {
  done(): boolean;
  bytesRemaining(): number;
  append(data: Uint8Array): void;
  nextRecord(): R | undefined;
}

export default async function getStreamedMcapInfo<R>(
  file: File,
  mcapStreamReader: GenericMcapStreamReader<R>,
  processRecord: (info: McapInfo, record: R) => void,
  fileType: string,
  reportProgress: (progress: number) => void,
): Promise<FileInfo> {
  const info: McapInfo = {
    totalMessages: 0n,
    numChunks: 0,
    numAttachments: 0,
    startTime: undefined,
    endTime: undefined,
    compressionTypes: new Set(),
    topicInfosByTopic: new Map(),
    topicNamesByChannelId: new Map(),
    schemaNamesById: new Map(),
  };

  // Use file.slice() rather than file.stream().getReader().read() because the latter has terrible
  // performance in Safari (~50x slower than Chrome).
  const chunkSize = 1024 * 1024;
  let bytesRead = 0;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
    mcapStreamReader.append(new Uint8Array(buffer));
    for (let record; (record = mcapStreamReader.nextRecord()) != undefined; ) {
      processRecord(info, record);
    }
    bytesRead += buffer.byteLength;
    reportProgress(bytesRead / file.size);
  }

  const topics = [...info.topicInfosByTopic.values()].sort((a, b) =>
    a.topic.localeCompare(b.topic),
  );
  return { ...info, fileType, topics };
}
