// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Bag, BagReader } from "@foxglove/rosbag";
import { BlobReader } from "@foxglove/rosbag/web";
import { Time } from "@foxglove/rostime";

export type TopicInfo = {
  topic: string;
  datatype: string;
  numMessages: number;
  numConnections: number;
};

export type BagInfo = {
  numChunks: number;
  totalMessages: number;
  startTime: Time | undefined;
  endTime: Time | undefined;
  topics: TopicInfo[];
};

export default async function getBagInfo(file: File): Promise<BagInfo> {
  const bag = new Bag(new BagReader(new BlobReader(file)));
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
