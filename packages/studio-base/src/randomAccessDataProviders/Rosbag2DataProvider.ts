// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Md5 } from "md5-typescript";

import { ROS2_TO_DEFINITIONS, Rosbag2, openFileSystemDirectoryHandle } from "@foxglove/rosbag2-web";
import { stringify } from "@foxglove/rosmsg";
import { Time } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import {
  MessageDefinitionsByTopic,
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

type BagFolderPath = { type: "folder"; folder: FileSystemDirectoryHandle | string };

type Options = { bagFolderPath: BagFolderPath };

export default class Rosbag2DataProvider implements RandomAccessDataProvider {
  private options_: Options;
  private bag_?: Rosbag2;

  constructor(options: Options, children: RandomAccessDataProviderDescriptor[]) {
    if (children.length > 0) {
      throw new Error("Rosbag2DataProvider cannot have children");
    }
    this.options_ = options;
  }

  async initialize(_extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    const folder = this.options_.bagFolderPath.folder;
    if (folder instanceof FileSystemDirectoryHandle) {
      const res = await fetch(new URL("sql.js/dist/sql-wasm.wasm", import.meta.url).toString());
      const sqlWasm = await (await res.blob()).arrayBuffer();
      this.bag_ = await openFileSystemDirectoryHandle(folder, sqlWasm);
    } else {
      throw new Error("Opening ROS2 bags via the native interface is not implemented yet");
    }

    const [start, end] = await this.bag_.timeRange();
    const topicDefs = await this.bag_.readTopics();
    const messageCounts = await this.bag_.messageCounts();

    const problems: RandomAccessDataProviderProblem[] = [];
    const topics: Topic[] = [];
    const connections: Connection[] = [];
    const datatypes: RosDatatypes = new Map();
    const messageDefinitionsByTopic: MessageDefinitionsByTopic = {};
    const parsedMessageDefinitionsByTopic: ParsedMessageDefinitionsByTopic = {};

    for (const topicDef of topicDefs) {
      const parsedMsgdef = ROS2_TO_DEFINITIONS.get(topicDef.type);
      if (parsedMsgdef == undefined) {
        problems.push({
          severity: "warning",
          message: `Topic "${topicDef.name}" has unrecognized datatype "${topicDef.type}"`,
        });
        continue;
      }

      // TODO: fullParsedMessageDefinitions should include all dependent message defs
      const fullParsedMessageDefinitions = [parsedMsgdef];
      const messageDefinition = stringify(fullParsedMessageDefinitions);
      const md5sum = Md5.init(messageDefinition);

      topics.push({
        name: topicDef.name,
        datatype: topicDef.type,
        numMessages: messageCounts.get(topicDef.name),
      });
      connections.push({
        messageDefinition,
        md5sum,
        topic: topicDef.name,
        type: topicDef.type,
        callerid: topicDef.name,
      });
      datatypes.set(topicDef.type, { name: topicDef.type, definitions: parsedMsgdef.definitions });
      messageDefinitionsByTopic[topicDef.name] = messageDefinition;
      parsedMessageDefinitionsByTopic[topicDef.name] = fullParsedMessageDefinitions;
    }

    return {
      start,
      end,
      topics,
      connections,
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
    if (this.bag_ == undefined) {
      throw new Error(`Rosbag2DataProvider is not initialized`);
    }

    const topics = subscriptions.parsedMessages as string[] | undefined;
    if (topics == undefined) {
      return {};
    }

    const parsedMessages: MessageEvent<unknown>[] = [];
    for await (const msg of this.bag_.readMessages({ startTime: start, endTime: end, topics })) {
      parsedMessages.push({
        topic: msg.topic.name,
        receiveTime: msg.timestamp,
        message: msg.data,
      });
    }

    return { parsedMessages };
  }

  async close(): Promise<void> {
    await this.bag_?.close();
  }
}
