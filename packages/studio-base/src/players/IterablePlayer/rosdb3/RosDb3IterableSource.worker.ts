// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { iterableTransferHandler } from "@foxglove/comlink-transfer-handlers";
import { ROS2_TO_DEFINITIONS, Rosbag2, SqliteSqljs } from "@foxglove/rosbag2-web";
import { stringify } from "@foxglove/rosmsg";
import { Time, add as addTime } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import {
  MessageDefinitionsByTopic,
  ParsedMessageDefinitionsByTopic,
  PlayerProblem,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import {
  IIterableSource,
  IteratorResult,
  Initalization,
  MessageIteratorArgs,
  GetBackfillMessagesArgs,
} from "../IIterableSource";

export class RosDb3IterableSource implements IIterableSource {
  private files: File[];
  private bag?: Rosbag2;
  private start: Time = { sec: 0, nsec: 0 };
  private end: Time = { sec: 0, nsec: 0 };

  public constructor(files: File[]) {
    this.files = files;
  }

  public async initialize(): Promise<Initalization> {
    const res = await fetch(
      new URL("@foxglove/sql.js/dist/sql-wasm.wasm", import.meta.url).toString(),
    );
    const sqlWasm = await (await res.blob()).arrayBuffer();
    await SqliteSqljs.Initialize({ wasmBinary: sqlWasm });

    const dbs = this.files.map((file) => new SqliteSqljs(file));
    const bag = new Rosbag2(dbs);
    await bag.open();
    this.bag = bag;

    const [start, end] = await this.bag.timeRange();
    const topicDefs = await this.bag.readTopics();
    const messageCounts = await this.bag.messageCounts();
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

    const problems: PlayerProblem[] = [];
    const topics: Topic[] = [];
    const topicStats = new Map<string, TopicStats>();
    const datatypes: RosDatatypes = new Map();
    const messageDefinitionsByTopic: MessageDefinitionsByTopic = {};
    const parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};

    for (const topicDef of topicDefs) {
      const numMessages = messageCounts.get(topicDef.name);

      topics.push({ name: topicDef.name, datatype: topicDef.type });
      if (numMessages != undefined) {
        topicStats.set(topicDef.name, { numMessages });
      }

      const parsedMsgdef = ROS2_TO_DEFINITIONS.get(topicDef.type);
      if (parsedMsgdef == undefined) {
        problems.push({
          severity: "warn",
          message: `Topic "${topicDef.name}" has unsupported datatype "${topicDef.type}"`,
          tip: "ROS 2 .db3 files do not contain message definitions, so only well-known ROS types are supported in Foxglove Studio. As a workaround, you can convert the db3 file to mcap using the mcap CLI. For more information, see: https://foxglove.dev/docs/studio/connection/local-file",
        });
        continue;
      }

      const fullParsedMessageDefinitions = [parsedMsgdef];
      const messageDefinition = stringify(fullParsedMessageDefinitions);
      datatypes.set(topicDef.type, { name: topicDef.type, definitions: parsedMsgdef.definitions });
      messageDefinitionsByTopic[topicDef.name] = messageDefinition;
      parsedMessageDefinitionsByTopic[topicDef.name] = fullParsedMessageDefinitions;
    }

    this.start = start;
    this.end = end;

    return {
      topics: Array.from(topics.values()),
      topicStats,
      start,
      end,
      problems,
      profile: "ros2",
      datatypes,
      publishersByTopic: new Map(),
    };
  }

  public async *messageIterator(
    opt: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (this.bag == undefined) {
      throw new Error(`Rosbag2DataProvider is not initialized`);
    }

    const topics = opt.topics;
    if (topics.length === 0) {
      return;
    }

    const start = opt.start ?? this.start;
    const end = opt.end ?? this.end;

    // Add 1 nsec to the end time because rosbag2 treats the time range as non-inclusive
    // of the exact end time.
    const inclusiveEndTime = addTime(end, { sec: 0, nsec: 1 });
    const msgIterator = this.bag.readMessages({
      startTime: start,
      endTime: inclusiveEndTime,
      topics,
    });
    for await (const msg of msgIterator) {
      yield {
        msgEvent: {
          topic: msg.topic.name,
          receiveTime: msg.timestamp,
          message: msg.value,
          sizeInBytes: msg.data.byteLength,
          schemaName: msg.topic.type,
        },
        connectionId: undefined,
        problem: undefined,
      };
    }
  }

  public async getBackfillMessages(
    _args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    return [];
  }
}

Comlink.transferHandlers.set("iterable", iterableTransferHandler);
Comlink.expose(RosDb3IterableSource);
