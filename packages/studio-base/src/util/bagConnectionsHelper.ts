// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import type { Bag } from "@foxglove/rosbag";
import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import { Topic, TopicStats } from "@foxglove/studio-base/players/types";
import { Connection } from "@foxglove/studio-base/randomAccessDataProviders/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

type DatatypeDescription = {
  messageDefinition: string;
  type: string;
};

// Extract one big list of datatypes from the individual connections.
export function bagConnectionsToDatatypes(
  connections: readonly DatatypeDescription[],
  { ros2 }: { ros2: boolean },
): RosDatatypes {
  const datatypes: RosDatatypes = new Map();
  connections.forEach((connection) => {
    const connectionDefinitions = parseMessageDefinition(connection.messageDefinition, { ros2 });
    connectionDefinitions.forEach(({ name, definitions }, index) => {
      // The first definition usually doesn't have an explicit name,
      // so we get the name from the datatype.
      if (index === 0) {
        datatypes.set(connection.type, { name: connection.type, definitions });
      } else if (name != undefined) {
        datatypes.set(name, { name, definitions });
      }
    });
  });
  return datatypes;
}

// Extract one big list of topics from the individual connections.
export function bagConnectionsToTopics(connections: readonly Connection[]): Topic[] {
  const topics = new Map<string, Topic>();
  for (const connection of connections) {
    const existingTopic = topics.get(connection.topic);
    if (existingTopic && existingTopic.datatype !== connection.type) {
      console.warn("duplicate topic with differing datatype", existingTopic, connection);
      continue;
    }
    topics.set(connection.topic, { name: connection.topic, datatype: connection.type });
  }
  return Array.from(topics.values());
}

export function bagConnectionsToTopicStats(
  connections: readonly Connection[],
  chunkInfos: typeof Bag.prototype.chunkInfos,
): Map<string, TopicStats> {
  const numMessagesByConnectionIndex: number[] = new Array(connections.length).fill(0);
  chunkInfos.forEach((info) => {
    info.connections.forEach(({ conn, count }) => {
      numMessagesByConnectionIndex[conn] += count;
    });
  });
  const topics = new Map<string, Topic>();
  const topicStats = new Map<string, TopicStats>();
  for (let index = 0; index < connections.length; index++) {
    const connection = connections[index]!;
    const existingTopic = topics.get(connection.topic);
    if (existingTopic && existingTopic.datatype !== connection.type) {
      console.warn("duplicate topic with differing datatype", existingTopic, connection);
      continue;
    }
    topics.set(connection.topic, { name: connection.topic, datatype: connection.type });
    const numMessages = numMessagesByConnectionIndex[index];
    if (numMessages != undefined) {
      topicStats.set(connection.topic, { numMessages });
    }
  }
  return topicStats;
}
