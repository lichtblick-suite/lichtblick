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

import { Time } from "@foxglove/rostime";
import { Progress, Topic, MessageEvent } from "@foxglove/studio-base/players/types";
import {
  BlockCache,
  MemoryCacheBlock,
} from "@foxglove/studio-base/randomAccessDataProviders/MemoryCacheDataProvider";
import { MESSAGE_FORMATS } from "@foxglove/studio-base/randomAccessDataProviders/constants";
import {
  RandomAccessDataProviderDescriptor,
  ExtensionPoint,
  GetDataProvider,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  RandomAccessDataProvider,
  MessageDefinitions,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import filterMap from "@foxglove/studio-base/util/filterMap";

export default class RenameDataProvider implements RandomAccessDataProvider {
  _provider: RandomAccessDataProvider;
  _prefix: string;

  constructor(
    args: { prefix?: string },
    children: RandomAccessDataProviderDescriptor[],
    getDataProvider: GetDataProvider,
  ) {
    const child = children[0];
    if (children.length !== 1 || !child) {
      throw new Error(`Incorrect number of children to RenameDataProvider: ${children.length}`);
    }
    if (args.prefix && !args.prefix.startsWith("/")) {
      throw new Error(`Prefix must have a leading forward slash: ${JSON.stringify(args.prefix)}`);
    }
    this._provider = getDataProvider(child);
    this._prefix = args.prefix ?? "";
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

    const convertTopicNameKey = <T>(objWithTopicNameKeys: Record<string, T>) => {
      const topicKeyResult: Record<string, T> = {};
      for (const [topicName, value] of Object.entries(objWithTopicNameKeys)) {
        topicKeyResult[`${this._prefix}${topicName}`] = value;
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
    return await this._provider.close();
  }

  _mapMessage = <T>(message: MessageEvent<T>): MessageEvent<T> => ({
    // Only map fields that we know are correctly mapped. Don't just splat in `...message` here
    // because we might miss an important mapping!
    topic: `${this._prefix}${message.topic}`,
    receiveTime: message.receiveTime,
    message: message.message,
  });

  async getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult> {
    const childTopics: { -readonly [K in keyof GetMessagesTopics]: GetMessagesTopics[K] } = {};
    for (const type of MESSAGE_FORMATS) {
      const originalTopics = topics[type];
      if (originalTopics) {
        childTopics[type] = originalTopics.map((topic) => {
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
    const { parsedMessages, rosBinaryMessages } = messages;

    return {
      parsedMessages: parsedMessages?.map(this._mapMessage),
      rosBinaryMessages: rosBinaryMessages?.map(this._mapMessage),
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

    const messagesByTopic: Record<string, MessageEvent<unknown>[]> = {};
    for (const [topicName, topicMessages] of Object.entries(block.messagesByTopic)) {
      messagesByTopic[`${this._prefix}${topicName}`] = topicMessages.map(this._mapMessage);
    }
    return { messagesByTopic, sizeInBytes: block.sizeInBytes };
  });
}
