// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import Logger from "@lichtblick/log";
import { ros1 } from "@lichtblick/rosmsg-msgs-common";
import { Time, fromMicros, isTimeInRangeInclusive, toMicroSec } from "@lichtblick/rostime";
import { MessageEvent, ParameterValue } from "@lichtblick/suite";
import {
  MessageDefinitionsByTopic,
  ParsedMessageDefinitionsByTopic,
  Topic,
  TopicStats,
  PlayerAlert,
} from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import { MessageType, ULog } from "@lichtblick/ulog";
import { BlobReader } from "@lichtblick/ulog/web";

import { messageIdToTopic, messageDefinitionToRos, logLevelToRosout } from "./support";
import {
  IIterableSource,
  IteratorResult,
  Initialization,
  MessageIteratorArgs,
  GetBackfillMessagesArgs,
} from "../IIterableSource";

type UlogOptions = { type: "file"; file: File };

const CHUNK_SIZE = 1024 * 1024;
const LOG_TOPIC = "Log";

const log = Logger.getLogger(__filename);

export class UlogIterableSource implements IIterableSource {
  #options: UlogOptions;
  #ulog?: ULog;
  #start?: Time;
  #end?: Time;

  public constructor(options: UlogOptions) {
    this.#options = options;
  }

  public async initialize(): Promise<Initialization> {
    const file = this.#options.file;
    const bytes = this.#options.file.size;
    log.debug(`initialize(${bytes} bytes)`);

    const startTime = performance.now();
    this.#ulog = new ULog(new BlobReader(file), { chunkSize: CHUNK_SIZE });
    await this.#ulog.open();
    const durationMs = performance.now() - startTime;
    log.debug(`opened in ${durationMs.toFixed(2)}ms`);

    const counts = this.#ulog.dataMessageCounts()!;
    const timeRange = this.#ulog.timeRange() ?? [0n, 0n];
    const start = fromMicros(Number(timeRange[0]));
    const end = fromMicros(Number(timeRange[1]));

    const alerts: PlayerAlert[] = [];
    const topics: Topic[] = [];
    const topicStats = new Map<string, TopicStats>();
    const datatypes: RosDatatypes = new Map();
    const messageDefinitionsByTopic: MessageDefinitionsByTopic = {};
    const parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};
    const header = this.#ulog.header!;

    topics.push({ name: LOG_TOPIC, schemaName: "rosgraph_msgs/Log" });
    topicStats.set(LOG_TOPIC, { numMessages: this.#ulog.logCount() ?? 0 });
    datatypes.set("rosgraph_msgs/Log", ros1["rosgraph_msgs/Log"]);

    for (const msgDef of header.definitions.values()) {
      datatypes.set(msgDef.name, messageDefinitionToRos(msgDef));
    }

    const topicNames = new Set<string>();
    for (const [msgId, msgDef] of this.#ulog.subscriptions.entries()) {
      const count = counts.get(msgId);
      if (count == undefined || count === 0) {
        continue;
      }

      const name = messageIdToTopic(msgId, this.#ulog);
      if (name && !topicNames.has(name)) {
        topicNames.add(name);
        topics.push({ name, schemaName: msgDef.name });
        topicStats.set(name, { numMessages: count });
        messageDefinitionsByTopic[name] = msgDef.format;
        const messageDefinition = datatypes.get(msgDef.name);
        if (messageDefinition) {
          parsedMessageDefinitionsByTopic[name] = [messageDefinition];
        }
      }
    }

    const parameters = new Map<string, ParameterValue>();
    for (const [key, entry] of header.parameters.entries()) {
      parameters.set(key, entry.value);
    }

    log.debug(`message definitions parsed`);

    this.#start = start;
    this.#end = end;

    return {
      start,
      end,
      topics,
      datatypes,
      profile: "ulog",
      alerts,
      publishersByTopic: new Map(),
      topicStats,
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (this.#ulog == undefined) {
      throw new Error(`UlogDataProvider is not initialized`);
    }

    const topics = args.topics;
    const start = args.start ?? this.#start;
    const end = args.end ?? this.#end;

    if (!start || !end) {
      throw new Error(`UlogDataProvider is not initialized`);
    }

    if (topics.size === 0) {
      return;
    }

    const startTime = BigInt(Math.floor(toMicroSec(start)));
    const endTime = BigInt(Math.floor(toMicroSec(end)));

    for await (const msg of this.#ulog.readMessages({ startTime, endTime })) {
      if (msg.type === MessageType.Data) {
        const timestamp = (msg.value as { timestamp: bigint }).timestamp;
        const receiveTime = fromMicros(Number(timestamp));
        const sub = this.#ulog.subscriptions.get(msg.msgId);
        const topic = sub?.name;
        if (topic && topics.has(topic) && isTimeInRangeInclusive(receiveTime, start, end)) {
          yield {
            type: "message-event",
            msgEvent: {
              topic,
              receiveTime,
              message: msg.value,
              sizeInBytes: msg.data.byteLength,
              schemaName: sub.name,
            },
          };
        }
      } else if (msg.type === MessageType.Log || msg.type === MessageType.LogTagged) {
        const receiveTime = fromMicros(Number(msg.timestamp));
        if (topics.has(LOG_TOPIC) && isTimeInRangeInclusive(receiveTime, start, end)) {
          yield {
            type: "message-event",
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
          };
        }
      }
    }
  }

  public async getBackfillMessages(_args: GetBackfillMessagesArgs): Promise<MessageEvent[]> {
    return [];
  }
}
