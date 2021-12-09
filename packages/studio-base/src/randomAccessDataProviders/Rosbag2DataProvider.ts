// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Md5 } from "md5-typescript";

import {
  BlobReader,
  ROS2_TO_DEFINITIONS,
  Rosbag2,
  openFileSystemDirectoryHandle,
  openFileSystemFile,
  FileEntry,
  SqliteSqljs,
} from "@foxglove/rosbag2-web";
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

type BagPath = { type: "file"; file: Blob };
type BagMultiPath = { type: "files"; files: File[] };
type BagFolderPath = { type: "folder"; folder: FileSystemDirectoryHandle };

type Options = { bagPath: BagPath | BagMultiPath | BagFolderPath };
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
    const res = await fetch(new URL("sql.js/dist/sql-wasm.wasm", import.meta.url).toString());
    const sqlWasm = await (await res.blob()).arrayBuffer();

    if (this.options_.bagPath.type === "files") {
      const files = this.options_.bagPath.files;
      const entries: FileEntry[] = files.map((f) => ({
        relativePath: (f as unknown as { path: string }).path,
        file: new BlobReader(f),
      }));
      const bag = new Rosbag2(entries, (fileEntry) => new SqliteSqljs(fileEntry.file, sqlWasm));
      await bag.open();
      this.bag_ = bag;
    } else if (this.options_.bagPath.type === "file") {
      const file = this.options_.bagPath.file;
      this.bag_ = await openFileSystemFile(file, sqlWasm);
    } else {
      const folder = this.options_.bagPath.folder;
      this.bag_ = await openFileSystemDirectoryHandle(folder, sqlWasm);
    }

    const [start, end] = await this.bag_.timeRange();
    const topicDefs = await this.bag_.readTopics();
    const messageCounts = await this.bag_.messageCounts();
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
          severity: "warn",
          message: `Topic "${topicDef.name}" has unrecognized datatype "${topicDef.type}"`,
          tip: "ROS 2 bags don't contain full message definitions, so only well-known ROS types are supported in Studio. As a workaround, you can try using a Rosbridge WebSocket connection. For more information, see: https://github.com/ros2/rosbag2/issues/782",
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
        message: msg.value,
        sizeInBytes: msg.data.byteLength,
      });
    }

    return { parsedMessages };
  }

  async close(): Promise<void> {
    await this.bag_?.close();
  }
}
