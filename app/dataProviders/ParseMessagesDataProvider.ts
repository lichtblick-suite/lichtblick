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

import { uniq } from "lodash";
import { Time, MessageReader } from "rosbag";

import {
  DataProvider,
  InitializationResult,
  ExtensionPoint,
  DataProviderDescriptor,
  GetDataProvider,
  GetMessagesResult,
  GetMessagesTopics,
} from "./types";
import ParsedMessageCache from "@foxglove-studio/app/dataProviders/ParsedMessageCache";
import { ParsedMessageDefinitionsByTopic } from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { FREEZE_MESSAGES } from "@foxglove-studio/app/util/globalConstants";

// Parses raw messages as returned by `BagDataProvider`. To make it fast to seek back and forth, we keep
// a small cache here, which maps messages from the underlying DataProvider to parsed messages. This assumes
// that usually the underlying DataProvider will give us the same message references, and fast, which should
// be the case when using the MemoryCacheDataProvider.
export default class ParseMessagesDataProvider implements DataProvider {
  // Underlying DataProvider.
  _provider: DataProvider;
  // Passed into `initialize`.
  _parsedMessageDefinitionsByTopic?: ParsedMessageDefinitionsByTopic;
  _messageCache = new ParsedMessageCache();

  // Reader per topic, as generated from the underlying DataProvider's `initialize` function.
  _readersByTopic: {
    [topic: string]: MessageReader;
  } = {};
  // Use this to signal that the _readersByTopic is fully initialized.
  _calledInitializeReaders = false;
  _datatypes: RosDatatypes = {};
  _datatypeNamesByTopic: {
    [topic: string]: string;
  } = {};

  constructor(_args: any, children: DataProviderDescriptor[], getDataProvider: GetDataProvider) {
    if (children.length !== 1) {
      throw new Error(
        `Incorrect number of children to ParseMessagesDataProvider: ${children.length}`,
      );
    }
    this._provider = getDataProvider(children[0]);
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    const result = await this._provider.initialize(extensionPoint);
    const { messageDefinitions, topics } = result;
    if (result.providesParsedMessages) {
      throw new Error(
        "ParseMessagesDataProvider should not be used with a provider provides already-parsed messages",
      );
    }
    if (messageDefinitions.type !== "parsed") {
      throw new Error("ParseMessagesDataProvider requires parsed message definitions");
    }
    this._parsedMessageDefinitionsByTopic = messageDefinitions.parsedMessageDefinitionsByTopic;
    this._datatypes = messageDefinitions.datatypes;
    topics.forEach(({ name, datatype }) => {
      this._datatypeNamesByTopic[name] = datatype;
    });
    // Initialize the readers asynchronously - we can load data without having the readers ready to parse it.
    return { ...result, providesParsedMessages: true };
  }

  // Make sure that we have a reader for each requested topic, but only create them on-demand.
  _getReadersByTopic(
    topics: string[],
  ): {
    [key: string]: MessageReader;
  } {
    const parsedMessageDefinitionsByTopic = this._parsedMessageDefinitionsByTopic;
    if (!parsedMessageDefinitionsByTopic) {
      throw new Error("ParseMessagesDataProvider: getMessages called before initialize");
    }
    topics.forEach((topic) => {
      if (!this._readersByTopic[topic]) {
        const parsedDefinition = parsedMessageDefinitionsByTopic[topic];
        this._readersByTopic[topic] = new MessageReader(parsedDefinition, {
          freeze: FREEZE_MESSAGES,
        });
      }
    });
    return this._readersByTopic;
  }

  async getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult> {
    const requestedParsedTopics = new Set(topics.parsedMessages);
    const requestedBinaryTopics = new Set(topics.bobjects);
    const readerTopics = [...(topics.parsedMessages || [])];
    const childTopics = {
      bobjects: uniq([...requestedParsedTopics, ...requestedBinaryTopics]),
    };
    // Kick off the request to the data provder to get the messages.
    const getMessagesPromise = this._provider.getMessages(start, end, childTopics);
    const readersByTopic = this._getReadersByTopic(readerTopics);
    const { bobjects } = await getMessagesPromise;
    if (bobjects == null) {
      throw new Error("Child of ParseMessagesProvider must provide binary messages");
    }
    const messagesToParse = bobjects.filter(({ topic }) => requestedParsedTopics.has(topic));
    const parsedMessages = this._messageCache.parseMessages(messagesToParse, readersByTopic);

    return {
      parsedMessages: parsedMessages.filter(({ topic }) => requestedParsedTopics.has(topic)),
      bobjects: bobjects.filter(({ topic }) => requestedBinaryTopics.has(topic)),
      rosBinaryMessages: undefined,
    };
  }

  close(): Promise<void> {
    return this._provider.close();
  }
}
