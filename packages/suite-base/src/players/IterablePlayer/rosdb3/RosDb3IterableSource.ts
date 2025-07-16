// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageDefinition } from "@lichtblick/message-definition";
import { ROS2_TO_DEFINITIONS, Rosbag2, SqliteSqljs } from "@lichtblick/rosbag2-web";
import { stringify } from "@lichtblick/rosmsg";
import { Time, add as addTime } from "@lichtblick/rostime";
import { MessageEvent } from "@lichtblick/suite";
import { PlayerAlert, TopicStats } from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import { basicDatatypes } from "@lichtblick/suite-base/util/basicDatatypes";

import {
  GetBackfillMessagesArgs,
  ISerializedIterableSource,
  Initialization,
  IteratorResult,
  MessageIteratorArgs,
  TopicWithDecodingInfo,
} from "../IIterableSource";

function dataTypeToFullName(dataType: string): string {
  const parts = dataType.split("/");
  if (parts.length === 2) {
    return `${parts[0]!}/msg/${parts[1]!}`;
  }
  return dataType;
}

export class RosDb3IterableSource implements ISerializedIterableSource {
  #files: File[];
  #bag?: Rosbag2;
  #start: Time = { sec: 0, nsec: 0 };
  #end: Time = { sec: 0, nsec: 0 };
  #textEncoder = new TextEncoder();

  public readonly sourceType = "serialized";

  public constructor(files: File[]) {
    this.#files = files;
  }

  public async initialize(): Promise<Initialization> {
    const res = await fetch(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL("@foxglove/sql.js/dist/sql-wasm.wasm", import.meta.url).toString(),
    );
    const sqlWasm = await (await res.blob()).arrayBuffer();
    await SqliteSqljs.Initialize({ wasmBinary: sqlWasm });

    const dbs = this.#files.map((file) => new SqliteSqljs(file));
    const bag = new Rosbag2(dbs);
    await bag.open();
    this.#bag = bag;

    const [start, end] = await this.#bag.timeRange();
    const topicDefs = await this.#bag.readTopics();
    const messageCounts = await this.#bag.messageCounts();
    let hasAnyMessages = false;
    for (const count of messageCounts.values()) {
      if (count > 0) {
        hasAnyMessages = true;
        break;
      }
    }
    if (!hasAnyMessages) {
      throw new Error("Bag contains no messages");
    }

    const alerts: PlayerAlert[] = [];
    const topics: TopicWithDecodingInfo[] = [];
    const topicStats = new Map<string, TopicStats>();
    // ROS 2 .db3 files do not contain message definitions, so we can only support well-known ROS types.
    const datatypes: RosDatatypes = new Map([...ROS2_TO_DEFINITIONS, ...basicDatatypes]);

    for (const topicDef of topicDefs) {
      const numMessages = messageCounts.get(topicDef.name);

      const topic: TopicWithDecodingInfo = {
        name: topicDef.name,
        schemaName: topicDef.type,
        messageEncoding: topicDef.serializationFormat,
      };

      if (numMessages != undefined) {
        topicStats.set(topicDef.name, { numMessages });
      }

      const parsedMsgdef = ROS2_TO_DEFINITIONS.get(topicDef.type);
      if (parsedMsgdef == undefined) {
        alerts.push({
          severity: "warn",
          message: `Topic "${topicDef.name}" has unsupported datatype "${topicDef.type}"`,
          tip: "ROS 2 .db3 files do not contain message definitions, so only well-known ROS types are supported in Foxglove Studio. As a workaround, you can convert the db3 file to mcap using the mcap CLI. For more information, see: https://docs.foxglove.dev/docs/connecting-to-data/frameworks/ros2",
        });
      } else {
        // Create the full gendeps-like message definition so that parseChannel() can parse it.
        const typesToProcess = [parsedMsgdef];
        const typesForMessage: MessageDefinition[] = [];
        const seenTypes = new Set<string>();
        while (typesToProcess.length > 0) {
          const rosType = typesToProcess.shift()!;
          typesForMessage.push(rosType);
          for (const { type, isComplex } of rosType.definitions) {
            const fullTypeName = dataTypeToFullName(type);
            if (isComplex === true && !seenTypes.has(fullTypeName)) {
              const newComplexType = ROS2_TO_DEFINITIONS.get(fullTypeName);
              if (!newComplexType) {
                // Should in theory never happen as these are all well-known types
                throw new Error(
                  `invariant: Subtype ${fullTypeName} of type ${rosType.name} not found.`,
                );
              }
              typesToProcess.push(newComplexType);
              seenTypes.add(fullTypeName);
            }
          }
        }

        const messageDefinition = stringify(typesForMessage);
        topic.schemaData = this.#textEncoder.encode(messageDefinition);
        topic.schemaEncoding = "ros2msg";
        topics.push(topic);
      }
    }

    this.#start = start;
    this.#end = end;

    return {
      topics: Array.from(topics.values()),
      topicStats,
      start,
      end,
      alerts,
      profile: "ros2",
      datatypes,
      publishersByTopic: new Map(),
    };
  }

  public async *messageIterator(
    opt: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    if (this.#bag == undefined) {
      throw new Error(`Rosbag2DataProvider is not initialized`);
    }

    const topics = opt.topics;
    if (topics.size === 0) {
      return;
    }

    const start = opt.start ?? this.#start;
    const end = opt.end ?? this.#end;

    // Add 1 nsec to the end time because rosbag2 treats the time range as non-inclusive
    // of the exact end time.
    const inclusiveEndTime = addTime(end, { sec: 0, nsec: 1 });
    const msgIterator = this.#bag.readMessages({
      startTime: start,
      endTime: inclusiveEndTime,
      topics: Array.from(topics.keys()),
      rawMessages: true,
    });
    for await (const msg of msgIterator) {
      yield {
        type: "message-event",
        msgEvent: {
          topic: msg.topic.name,
          receiveTime: msg.timestamp,
          message: msg.data,
          sizeInBytes: msg.data.byteLength,
          schemaName: msg.topic.type,
        },
      };
    }
  }

  public async getBackfillMessages(
    _args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<Uint8Array>[]> {
    return [];
  }
}
