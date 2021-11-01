// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@foxglove/log";
import { RosMsgDefinition, RosMsgField } from "@foxglove/rosmsg";
import { definitions as rosCommonDefinitions } from "@foxglove/rosmsg-msgs-common";
import { Time, fromMicros, isTimeInRangeInclusive, toMicroSec } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import {
  MessageDefinitionsByTopic,
  ParameterValue,
  ParsedMessageDefinitionsByTopic,
  Topic,
} from "@foxglove/studio-base/players/types";
import {
  Connection,
  RandomAccessDataProvider,
  RandomAccessDataProviderDescriptor,
  RandomAccessDataProviderProblem,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import {
  LogLevel,
  MessageDefinition as UlogMsgDefinition,
  MessageType,
  ULog,
} from "@foxglove/ulog";
import { BlobReader } from "@foxglove/ulog/web";

const CHUNK_SIZE = 1024 * 1024;
const LOG_TOPIC = "Log";

const log = Logger.getLogger(__filename);

type UlogPath = { type: "file"; file: Blob };
type Options = { filePath: UlogPath };

export default class UlogDataProvider implements RandomAccessDataProvider {
  private _options: Options;
  private _ulog?: ULog;

  constructor(options: Options, children: RandomAccessDataProviderDescriptor[]) {
    if (children.length > 0) {
      throw new Error("UlogDataProvider cannot have children");
    }
    this._options = options;
  }

  async initialize(_extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    const file = this._options.filePath.file;
    const bytes = this._options.filePath.file.size;
    log.debug(`initialize(${bytes} bytes)`);

    const startTime = performance.now();
    this._ulog = new ULog(new BlobReader(file), { chunkSize: CHUNK_SIZE });
    await this._ulog.open();
    const durationMs = performance.now() - startTime;
    log.debug(`opened in ${durationMs.toFixed(2)}ms`);

    const counts = this._ulog.dataMessageCounts()!;
    const timeRange = this._ulog.timeRange() ?? [0n, 0n];
    const start = fromMicros(Number(timeRange[0]));
    const end = fromMicros(Number(timeRange[1]));

    const problems: RandomAccessDataProviderProblem[] = [];
    const topics: Topic[] = [];
    const connections: Connection[] = [];
    const datatypes: RosDatatypes = new Map();
    const messageDefinitionsByTopic: MessageDefinitionsByTopic = {};
    const parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};
    const header = this._ulog.header!;

    topics.push({
      name: LOG_TOPIC,
      datatype: "rosgraph_msgs/Log",
      numMessages: this._ulog.logCount() ?? 0,
    });
    datatypes.set("rosgraph_msgs/Log", rosCommonDefinitions["rosgraph_msgs/Log"]);

    for (const msgDef of header.definitions.values()) {
      datatypes.set(msgDef.name, messageDefinitionToRos(msgDef));
    }

    const topicNames = new Set<string>();
    for (const [msgId, msgDef] of this._ulog.subscriptions.entries()) {
      const count = counts.get(msgId);
      if (count == undefined || count === 0) {
        continue;
      }

      const name = messageIdToTopic(msgId, this._ulog);
      if (name && !topicNames.has(name)) {
        topicNames.add(name);
        topics.push({ name, datatype: msgDef.name, numMessages: count });
        messageDefinitionsByTopic[name] = msgDef.format;
        const rosMsgDef = datatypes.get(msgDef.name);
        if (rosMsgDef) {
          parsedMessageDefinitionsByTopic[name] = [rosMsgDef];
        }
      }

      if (name) {
        connections.push({
          messageDefinition: msgDef.format,
          md5sum: "",
          topic: name,
          type: msgDef.name,
          callerid: String(msgId),
        });
      }
    }

    const parameters = new Map<string, ParameterValue>();
    for (const [key, entry] of header.parameters.entries()) {
      parameters.set(key, entry.value);
    }

    log.debug(`message definitions parsed`);

    return {
      start,
      end,
      topics,
      connections,
      parameters,
      providesParsedMessages: true,
      messageDefinitions: {
        type: "parsed",
        datatypes,
        messageDefinitionsByTopic,
        parsedMessageDefinitionsByTopic,
      },
      problems,
    };
  }

  async getMessages(
    start: Time,
    end: Time,
    subscriptions: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    if (this._ulog == undefined) {
      throw new Error(`UlogDataProvider is not initialized`);
    }

    // log.debug(`getMessages(${start.sec}, ${end.sec}, ${subscriptions.parsedMessages})`);

    const topics = subscriptions.parsedMessages;
    if (topics == undefined || topics.length === 0) {
      return {};
    }

    const startTime = BigInt(Math.floor(toMicroSec(start)));
    const endTime = BigInt(Math.floor(toMicroSec(end)));
    const parsedMessages: MessageEvent<unknown>[] = [];

    for await (const msg of this._ulog.readMessages({ startTime, endTime })) {
      if (msg.type === MessageType.Data) {
        const timestamp = (msg.value as { timestamp: bigint }).timestamp;
        const receiveTime = fromMicros(Number(timestamp));
        const topic = messageIdToTopic(msg.msgId, this._ulog);
        if (topic && topics.includes(topic) && isTimeInRangeInclusive(receiveTime, start, end)) {
          parsedMessages.push({
            topic,
            receiveTime,
            message: msg.value,
          });
        }
      } else if (msg.type === MessageType.Log || msg.type === MessageType.LogTagged) {
        const receiveTime = fromMicros(Number(msg.timestamp));
        if (topics.includes(LOG_TOPIC) && isTimeInRangeInclusive(receiveTime, start, end)) {
          parsedMessages.push({
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
          });
        }
      }
    }

    return { parsedMessages };
  }

  async close(): Promise<void> {
    log.info(`close()`);
    this._ulog = undefined;
  }
}

function logLevelToRosout(level: LogLevel): number {
  switch (level) {
    case LogLevel.Emerg:
    case LogLevel.Alert:
    case LogLevel.Crit:
      return 16; // fatal/critical
    case LogLevel.Err:
      return 8; // error
    case LogLevel.Warning:
      return 4; // warning
    case LogLevel.Notice:
    case LogLevel.Info:
      return 2; // info
    case LogLevel.Debug:
    default:
      return 1; // debug
  }
}

function messageIdToTopic(msgId: number, ulog: ULog): string | undefined {
  return ulog.subscriptions.get(msgId)?.name;
}

function messageDefinitionToRos(msgDef: UlogMsgDefinition): RosMsgDefinition {
  const definitions: RosMsgField[] = [];

  for (const field of msgDef.fields) {
    const isString = field.type === "char";
    definitions.push({
      name: field.name,
      type: typeToRos(field.type),
      isArray: field.arrayLength != undefined && !isString,
      arrayLength: isString ? undefined : field.arrayLength,
      upperBound: isString ? field.arrayLength ?? 1 : undefined,
      isComplex: field.isComplex,
    });
  }

  return { name: msgDef.name, definitions };
}

function typeToRos(type: string): string {
  switch (type) {
    case "int8_t":
      return "int8";
    case "uint8_t":
      return "uint8";
    case "int16_t":
      return "int16";
    case "uint16_t":
      return "uint16";
    case "int32_t":
      return "int32";
    case "uint32_t":
      return "uint32";
    case "int64_t":
      return "int64";
    case "uint64_t":
      return "uint64";
    case "float":
      return "float32";
    case "double":
      return "float64";
    case "bool":
      return "bool";
    case "char":
      return "string";
    default:
      return type;
  }
}
