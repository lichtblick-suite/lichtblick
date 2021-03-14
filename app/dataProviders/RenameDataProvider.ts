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

import memoizeWeak from "memoize-weak";
import { Time } from "rosbag";

import {
  BlockCache,
  MemoryCacheBlock,
} from "@foxglove-studio/app/dataProviders/MemoryCacheDataProvider";
import { MESSAGE_FORMATS } from "@foxglove-studio/app/dataProviders/constants";
import {
  DataProviderDescriptor,
  ExtensionPoint,
  GetDataProvider,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  DataProvider,
  MessageDefinitions,
} from "@foxglove-studio/app/dataProviders/types";
import { Message, Progress, Topic } from "@foxglove-studio/app/players/types";
import filterMap from "@foxglove-studio/app/util/filterMap";

export default class RenameDataProvider implements DataProvider {
  _provider: DataProvider;
  _prefix: string;

  constructor(
    args: { prefix?: string },
    children: DataProviderDescriptor[],
    getDataProvider: GetDataProvider,
  ) {
    if (children.length !== 1) {
      throw new Error(`Incorrect number of children to RenameDataProvider: ${children.length}`);
    }
    if (args.prefix && !args.prefix.startsWith("/")) {
      throw new Error(`Prefix must have a leading forward slash: ${JSON.stringify(args.prefix)}`);
    }
    this._provider = getDataProvider(children[0]);
    this._prefix = args.prefix || "";
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    const result = await this._provider.initialize({
      ...extensionPoint,
      progressCallback: (progress: Progress) => {
        extensionPoint.progressCallback({
          // Only map fields that we know are correctly mapped. Don't just splat in `...progress` here
          // because we might miss an important mapping!
          fullyLoadedFractionRanges: progress.fullyLoadedFractionRanges,
          messageCache: progress.messageCache
            ? this._mapMessageCache(progress.messageCache)
            : undefined,
        });
      },
    });
    const { messageDefinitions } = result;

    const convertTopicNameKey = (objWithTopicNameKeys: any) => {
      const topicKeyResult: Record<string, any> = {};
      for (const topicName of Object.keys(objWithTopicNameKeys)) {
        topicKeyResult[`${this._prefix}${topicName}`] = objWithTopicNameKeys[topicName];
      }
      return topicKeyResult;
    };
    let newMessageDefinitions: MessageDefinitions;
    if (messageDefinitions.type === "parsed") {
      newMessageDefinitions = {
        type: "parsed",
        datatypes: messageDefinitions.datatypes,
        messageDefinitionsByTopic: convertTopicNameKey(
          messageDefinitions.messageDefinitionsByTopic,
        ),
        parsedMessageDefinitionsByTopic: convertTopicNameKey(
          messageDefinitions.parsedMessageDefinitionsByTopic,
        ),
      };
    } else {
      newMessageDefinitions = {
        type: "raw",
        messageDefinitionsByTopic: convertTopicNameKey(
          messageDefinitions.messageDefinitionsByTopic,
        ),
        messageDefinitionMd5SumByTopic: messageDefinitions.messageDefinitionMd5SumByTopic
          ? convertTopicNameKey(messageDefinitions.messageDefinitionMd5SumByTopic)
          : undefined,
      };
    }

    return {
      ...result,
      topics: filterMap(result.topics, (topic: Topic) => ({
        // Only map fields that we know are correctly mapped. Don't just splat in `...topic` here
        // because we might miss an important mapping!
        name: `${this._prefix}${topic.name}`,
        originalTopic: topic.name,
        datatype: topic.datatype, // TODO(JP): We might want to map datatypes with a prefix in the future, to avoid collisions.
        numMessages: topic.numMessages,
      })),
      messageDefinitions: newMessageDefinitions,
    };
  }

  async close(): Promise<void> {
    return this._provider.close();
  }

  _mapMessage = (message: Message) => ({
    // Only map fields that we know are correctly mapped. Don't just splat in `...message` here
    // because we might miss an important mapping!
    topic: `${this._prefix}${message.topic}`,
    receiveTime: message.receiveTime,
    message: message.message,
  });

  async getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult> {
    const childTopics: any = {};
    for (const type of MESSAGE_FORMATS) {
      if (topics[type]) {
        childTopics[type] = (topics[type] as any).map((topic: any) => {
          if (!topic.startsWith(this._prefix)) {
            throw new Error(
              "RenameDataProvider#getMessages called with topic that doesn't match prefix",
            );
          }
          return topic.slice(this._prefix.length);
        });
      }
    }
    const messages = await this._provider.getMessages(start, end, childTopics);
    const { parsedMessages, rosBinaryMessages, bobjects } = messages;

    return {
      parsedMessages: parsedMessages && parsedMessages.map(this._mapMessage),
      rosBinaryMessages: rosBinaryMessages && rosBinaryMessages.map(this._mapMessage),
      bobjects: bobjects && bobjects.map(this._mapMessage),
    };
  }

  _mapMessageCache = memoizeWeak(
    (messageCache: BlockCache): BlockCache => ({
      // Note: don't just map(this._mapBlock) because map also passes the array and defeats the
      // memoization.
      blocks: messageCache.blocks.map((block) => this._mapBlock(block)),
      startTime: messageCache.startTime,
    }),
  );

  _mapBlock = memoizeWeak((block?: MemoryCacheBlock): MemoryCacheBlock | undefined => {
    if (!block) {
      return;
    }

    const messagesByTopic: any = {};
    for (const topicName of Object.keys(block.messagesByTopic)) {
      messagesByTopic[`${this._prefix}${topicName}`] = block.messagesByTopic[topicName].map(
        this._mapMessage,
      );
    }
    return { messagesByTopic, sizeInBytes: block.sizeInBytes };
  });
}
