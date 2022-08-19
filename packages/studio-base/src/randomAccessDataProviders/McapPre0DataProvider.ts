// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapPre0Reader as McapReader, McapPre0Types } from "@mcap/core";
import { isEqual } from "lodash";
import protobufjs from "protobufjs";
import descriptor from "protobufjs/ext/descriptor";

import { loadDecompressHandlers } from "@foxglove/mcap-support";
import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import { LazyMessageReader } from "@foxglove/rosmsg-serialization";
import { MessageReader as ROS2MessageReader } from "@foxglove/rosmsg2-serialization";
import {
  Time,
  compare,
  isLessThan,
  isGreaterThan,
  isTimeInRangeInclusive,
} from "@foxglove/rostime";
import { MessageEvent, Topic, TopicStats } from "@foxglove/studio-base/players/types";
import {
  RandomAccessDataProvider,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  Connection,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

type Options = { stream: ReadableStream<Uint8Array> };

export default class McapPre0DataProvider implements RandomAccessDataProvider {
  private options: Options;
  private messagesByChannel?: Map<number, MessageEvent<unknown>[]>;

  public constructor(options: Options) {
    this.options = options;
  }

  public async initialize(_extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    const decompressHandlers = await loadDecompressHandlers();

    const streamReader = this.options.stream.getReader();

    const messagesByChannel = new Map<number, MessageEvent<unknown>[]>();
    const channelInfoById = new Map<
      number,
      {
        info: McapPre0Types.ChannelInfo;
        messageDeserializer: ROS2MessageReader | LazyMessageReader | protobufjs.Type;
      }
    >();

    let startTime: Time | undefined;
    let endTime: Time | undefined;
    function processRecord(record: McapPre0Types.McapRecord) {
      switch (record.type) {
        default:
          break;

        case "ChannelInfo": {
          const existingInfo = channelInfoById.get(record.id);
          if (existingInfo) {
            if (!isEqual(existingInfo.info, record)) {
              throw new Error(`differing channel infos for for ${record.id}`);
            }
            break;
          }
          let messageDeserializer;
          if (record.encoding === "ros1") {
            const parsedDefinitions = parseMessageDefinition(record.schema);
            messageDeserializer = new LazyMessageReader(parsedDefinitions);
          } else if (record.encoding === "ros2") {
            const parsedDefinitions = parseMessageDefinition(record.schema, {
              ros2: true,
            });
            messageDeserializer = new ROS2MessageReader(parsedDefinitions);
          } else if (record.encoding === "protobuf") {
            const decodedByteLength = protobufjs.util.base64.length(record.schema);
            const arr = new Uint8Array(decodedByteLength);
            protobufjs.util.base64.decode(record.schema, arr, 0);

            const descriptorMsg = descriptor.FileDescriptorSet.decode(arr);
            const MsgRoot = protobufjs.Root.fromDescriptor(descriptorMsg);
            const Deserializer = MsgRoot.root.lookupType(record.schemaName);
            messageDeserializer = Deserializer;
          } else {
            throw new Error(`unsupported schema format ${record.schema}`);
          }
          channelInfoById.set(record.id, { info: record, messageDeserializer });
          messagesByChannel.set(record.id, []);
          break;
        }

        case "Message": {
          const channelId = record.channelInfo.id;
          const channelInfo = channelInfoById.get(channelId);
          const messages = messagesByChannel.get(channelId);
          if (!channelInfo || !messages) {
            throw new Error(`message for channel ${channelId} with no prior channel info`);
          }
          const receiveTime = {
            sec: Number(record.timestamp / 1000000000n),
            nsec: Number(record.timestamp % 1000000000n),
          };
          if (!startTime || isLessThan(receiveTime, startTime)) {
            startTime = receiveTime;
          }
          if (!endTime || isGreaterThan(receiveTime, endTime)) {
            endTime = receiveTime;
          }

          if (channelInfo.messageDeserializer instanceof protobufjs.Type) {
            const protoMsg = channelInfo.messageDeserializer.decode(new Uint8Array(record.data));
            messages.push({
              topic: channelInfo.info.topic,
              receiveTime,
              message: channelInfo.messageDeserializer.toObject(protoMsg, { defaults: true }),
              sizeInBytes: record.data.byteLength,
            });
          } else {
            messages.push({
              topic: channelInfo.info.topic,
              receiveTime,
              message: channelInfo.messageDeserializer.readMessage(new Uint8Array(record.data)),
              sizeInBytes: record.data.byteLength,
            });
          }
          break;
        }
      }
    }

    const reader = new McapReader({ decompressHandlers });
    for (let result; (result = await streamReader.read()), !result.done; ) {
      reader.append(result.value);
      for (let record; (record = reader.nextRecord()); ) {
        processRecord(record);
      }
    }

    this.messagesByChannel = messagesByChannel;

    const topics: Topic[] = [];
    const connections: Connection[] = [];
    const datatypes: RosDatatypes = new Map([["TODO", { definitions: [] }]]);

    for (const { info } of channelInfoById.values()) {
      topics.push({
        name: info.topic,
        datatype: info.schemaName,
      });

      datatypes.set(info.schemaName, {
        definitions: [],
      });
    }

    return {
      start: startTime ?? { sec: 0, nsec: 0 },
      end: endTime ?? { sec: 0, nsec: 0 },
      topics,
      topicStats: new Map<string, TopicStats>(),
      connections,
      providesParsedMessages: true,
      profile: undefined,
      messageDefinitions: {
        type: "parsed",
        datatypes,
        messageDefinitionsByTopic: {},
        parsedMessageDefinitionsByTopic: {},
      },
      problems: [],
    };
  }

  public async getMessages(
    start: Time,
    end: Time,
    subscriptions: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    if (!this.messagesByChannel) {
      throw new Error("initialization not completed");
    }
    const topics = subscriptions.parsedMessages;
    if (topics == undefined) {
      return {};
    }
    const topicsSet = new Set(topics);

    const parsedMessages: MessageEvent<unknown>[] = [];
    for (const messages of this.messagesByChannel.values()) {
      for (const message of messages) {
        if (
          isTimeInRangeInclusive(message.receiveTime, start, end) &&
          topicsSet.has(message.topic)
        ) {
          parsedMessages.push(message);
        }
      }
    }
    parsedMessages.sort((msg1, msg2) => compare(msg1.receiveTime, msg2.receiveTime));

    return { parsedMessages };
  }

  public async close(): Promise<void> {}
}
