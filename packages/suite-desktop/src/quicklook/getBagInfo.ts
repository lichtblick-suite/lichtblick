// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Bag } from "@lichtblick/rosbag";
import { BlobReader } from "@lichtblick/rosbag/web";

import { FileInfo, TopicInfo } from "./types";

export async function getBagInfo(file: File): Promise<FileInfo> {
  const bag = new Bag(new BlobReader(file));
  await bag.open();
  const numMessagesByConnectionIndex = Array.from(bag.connections.values(), () => 0n);
  let totalMessages = 0n;
  for (const chunk of bag.chunkInfos) {
    for (const { conn, count } of chunk.connections) {
      if (numMessagesByConnectionIndex[conn] == undefined) {
        numMessagesByConnectionIndex[conn] = 0n;
      }
      numMessagesByConnectionIndex[conn] += BigInt(count);
      totalMessages += BigInt(count);
    }
  }

  const topicInfosByTopic = new Map<string, TopicInfo>();
  for (const { topic, type: schemaName, conn } of bag.connections.values()) {
    const info = topicInfosByTopic.get(topic);
    const numMessages = numMessagesByConnectionIndex[conn];
    if (info != undefined) {
      if (info.schemaName !== schemaName) {
        info.schemaName = "(multiple)";
      }
      if (numMessages != undefined) {
        info.numMessages = (info.numMessages ?? 0n) + numMessages;
      }
      info.numConnections++;
    } else {
      topicInfosByTopic.set(topic, {
        topic,
        schemaName: schemaName ?? "(unknown)",
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
