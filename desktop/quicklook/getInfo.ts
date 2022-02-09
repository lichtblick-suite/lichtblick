// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import decompressLZ4 from "wasm-lz4";

import Logger from "@foxglove/log";
import {
  Mcap0StreamReader,
  McapPre0Reader,
  Mcap0Types,
  detectVersion,
  DETECT_VERSION_BYTES_REQUIRED,
} from "@foxglove/mcap";
import { Bag } from "@foxglove/rosbag";
import { BlobReader } from "@foxglove/rosbag/web";

import getIndexedMcapInfo from "./getIndexedMcapInfo";
import getStreamedMcapInfo, {
  processMcap0Record,
  processMcapPre0Record,
} from "./getStreamedMcapInfo";
import { FileInfo, TopicInfo } from "./types";

const log = Logger.getLogger(__filename);

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
    const numMessages = numMessagesByConnectionIndex[conn];
    if (info != undefined) {
      if (info.datatype !== datatype) {
        info.datatype = "(multiple)";
      }
      if (numMessages != undefined) {
        info.numMessages = (info.numMessages ?? 0n) + numMessages;
      }
      info.numConnections++;
    } else {
      topicInfosByTopic.set(topic, {
        topic,
        datatype: datatype ?? "(unknown)",
        numMessages,
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
            new Mcap0StreamReader({ includeChunks: true, decompressHandlers, validateCrcs: true }),
            processMcap0Record,
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
            new McapPre0Reader({
              includeChunks: true,
              validateChunkCrcs: false,
              decompressHandlers,
            }),
            processMcapPre0Record,
            "MCAP pre-v0",
            reportProgress,
          ),
      };
  }
}
