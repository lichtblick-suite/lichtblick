// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@foxglove/log";
import { ros1 } from "@foxglove/rosmsg-msgs-common";
import { Time, fromMicros, isTimeInRangeInclusive, toMicroSec } from "@foxglove/rostime";
import { MessageEvent, ParameterValue } from "@foxglove/studio";
import {
  MessageDefinitionsByTopic,
  ParsedMessageDefinitionsByTopic,
  Topic,
  TopicStats,
  PlayerProblem,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { MessageType, ULog } from "@foxglove/ulog";
import { BlobReader } from "@foxglove/ulog/web";

import {
  IIterableSource,
  IteratorResult,
  Initalization,
  MessageIteratorArgs,
  GetBackfillMessagesArgs,
} from "../IIterableSource";
import { messageIdToTopic, messageDefinitionToRos, logLevelToRosout } from "./support";

type UlogOptions = { type: "file"; file: File };

const CHUNK_SIZE = 1024 * 1024;
const LOG_TOPIC = "Log";

const log = Logger.getLogger(__filename);

export class UlogIterableSource implements IIterableSource {
  private options: UlogOptions;
  private ulog?: ULog;
  private start?: Time;
  private end?: Time;

  public constructor(options: UlogOptions) {
    this.options = options;
  }

  public async initialize(): Promise<Initalization> {
    const file = this.options.file;
    const bytes = this.options.file.size;
    log.debug(`initialize(${bytes} bytes)`);

    const startTime = performance.now();
    this.ulog = new ULog(new BlobReader(file), { chunkSize: CHUNK_SIZE });
    await this.ulog.open();
    const durationMs = performance.now() - startTime;
    log.debug(`opened in ${durationMs.toFixed(2)}ms`);

    const counts = this.ulog.dataMessageCounts()!;
    const timeRange = this.ulog.timeRange() ?? [0n, 0n];
    const start = fromMicros(Number(timeRange[0]));
    const end = fromMicros(Number(timeRange[1]));

    const problems: PlayerProblem[] = [];
    const topics: Topic[] = [];
    const topicStats = new Map<string, TopicStats>();
    const datatypes: RosDatatypes = new Map();
    const messageDefinitionsByTopic: MessageDefinitionsByTopic = {};
    const parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};
    const header = this.ulog.header!;

    topics.push({ name: LOG_TOPIC, schemaName: "rosgraph_msgs/Log" });
    topicStats.set(LOG_TOPIC, { numMessages: this.ulog.logCount() ?? 0 });
    datatypes.set("rosgraph_msgs/Log", ros1["rosgraph_msgs/Log"]);

    for (const msgDef of header.definitions.values()) {
      datatypes.set(msgDef.name, messageDefinitionToRos(msgDef));
    }

    const topicNames = new Set<string>();
    for (const [msgId, msgDef] of this.ulog.subscriptions.entries()) {
      const count = counts.get(msgId);
      if (count == undefined || count === 0) {
        continue;
      }

      const name = messageIdToTopic(msgId, this.ulog);
      if (name && !topicNames.has(name)) {
        topicNames.add(name);
        topics.push({ name, schemaName: msgDef.name });
        topicStats.set(name, { numMessages: count });
        messageDefinitionsByTopic[name] = msgDef.format;
        const rosMsgDef = datatypes.get(msgDef.name);
        if (rosMsgDef) {
          parsedMessageDefinitionsByTopic[name] = [rosMsgDef];
        }
      }
    }

    const parameters = new Map<string, ParameterValue>();
    for (const [key, entry] of header.parameters.entries()) {
      parameters.set(key, entry.value);
    }

    log.debug(`message definitions parsed`);

    this.start = start;
    this.end = end;

    return {
      start,
      end,
      topics,
      datatypes,
      profile: "ulog",
      problems,
      publishersByTopic: new Map(),
      topicStats,
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (this.ulog == undefined) {
      throw new Error(`UlogDataProvider is not initialized`);
    }

    const topics = args.topics;
    const start = args.start ?? this.start;
    const end = args.end ?? this.end;

    if (!start || !end) {
      throw new Error(`UlogDataProvider is not initialized`);
    }

    if (topics.length === 0) {
      return;
    }

    const startTime = BigInt(Math.floor(toMicroSec(start)));
    const endTime = BigInt(Math.floor(toMicroSec(end)));

    for await (const msg of this.ulog.readMessages({ startTime, endTime })) {
      if (msg.type === MessageType.Data) {
        const timestamp = (msg.value as { timestamp: bigint }).timestamp;
        const receiveTime = fromMicros(Number(timestamp));
        const sub = this.ulog.subscriptions.get(msg.msgId);
        const topic = sub?.name;
        if (topic && topics.includes(topic) && isTimeInRangeInclusive(receiveTime, start, end)) {
          yield {
            msgEvent: {
              topic,
              receiveTime,
              message: msg.value,
              sizeInBytes: msg.data.byteLength,
              schemaName: sub.name,
            },
            connectionId: undefined,
            problem: undefined,
          };
        }
      } else if (msg.type === MessageType.Log || msg.type === MessageType.LogTagged) {
        const receiveTime = fromMicros(Number(msg.timestamp));
        if (topics.includes(LOG_TOPIC) && isTimeInRangeInclusive(receiveTime, start, end)) {
          yield {
            msgEvent: {
              topic: LOG_TOPIC,
              receiveTime,
              message: {
                file: "",
                function: "",
                header: { stamp: receiveTime },
                level: logLevelToRosout(msg.logLevel),
                line: 0,
                msg: msg.message,
                name: "",
              },
              schemaName: "rosgraph_msgs/Log",
              sizeInBytes: msg.size,
            },
            connectionId: undefined,
            problem: undefined,
          };
        }
      }
    }
  }

  public async getBackfillMessages(
    _args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    return [];
  }
}
