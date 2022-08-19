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

import { last } from "lodash";

import { Time, compare, isGreaterThan, isLessThan } from "@foxglove/rostime";
import {
  Topic,
  MessageDefinitionsByTopic,
  ParsedMessageDefinitionsByTopic,
  MessageEvent,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import {
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  RandomAccessDataProvider,
  MessageDefinitions,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

function filterMessages<T>(
  start: Time,
  end: Time,
  topics: readonly string[],
  messages: readonly MessageEvent<T>[] | undefined,
) {
  if (messages == undefined) {
    return undefined;
  }
  const ret = [];
  for (const message of messages) {
    if (isGreaterThan(message.receiveTime, end)) {
      break;
    }
    if (isLessThan(message.receiveTime, start)) {
      continue;
    }
    if (!topics.includes(message.topic)) {
      continue;
    }
    ret.push(message);
  }
  return ret;
}

type MemoryDataProviderOptions = {
  messages: GetMessagesResult;
  topics?: Topic[];
  topicStats: Map<string, TopicStats>;
  datatypes?: RosDatatypes;
  messageDefinitionsByTopic?: MessageDefinitionsByTopic;
  parsedMessageDefinitionsByTopic?: ParsedMessageDefinitionsByTopic;
  initiallyLoaded?: boolean;
  providesParsedMessages?: boolean;
  profile: string;
};

// in-memory data provider for tests
// ts-prune-ignore-next
export default class MemoryDataProvider implements RandomAccessDataProvider {
  public messages: GetMessagesResult;
  public topics?: Topic[];
  public topicStats: Map<string, TopicStats>;
  public datatypes?: RosDatatypes;
  public messageDefinitionsByTopic: MessageDefinitionsByTopic;
  public parsedMessageDefinitionsByTopic?: ParsedMessageDefinitionsByTopic;
  public extensionPoint?: ExtensionPoint;
  public initiallyLoaded: boolean;
  public providesParsedMessages: boolean;
  public profile: string;

  public constructor({
    messages,
    topics,
    topicStats,
    datatypes,
    initiallyLoaded = false,
    messageDefinitionsByTopic,
    parsedMessageDefinitionsByTopic,
    providesParsedMessages,
    profile,
  }: MemoryDataProviderOptions) {
    this.messages = messages;
    this.topics = topics;
    this.topicStats = topicStats;
    this.datatypes = datatypes;
    this.messageDefinitionsByTopic = messageDefinitionsByTopic ?? {};
    this.parsedMessageDefinitionsByTopic = parsedMessageDefinitionsByTopic;
    this.initiallyLoaded = initiallyLoaded;
    this.providesParsedMessages = providesParsedMessages ?? messages.parsedMessages != undefined;
    this.profile = profile;
  }

  public async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    this.extensionPoint = extensionPoint;

    if (!this.initiallyLoaded) {
      // Report progress during `initialize` to state intention to provide progress (for testing)
      this.extensionPoint.progressCallback({
        fullyLoadedFractionRanges: [{ start: 0, end: 0 }],
      });
    }
    const { parsedMessages, encodedMessages } = this.messages;
    const sortedMessages = [...(parsedMessages ?? []), ...(encodedMessages ?? [])].sort((m1, m2) =>
      compare(m1.receiveTime, m2.receiveTime),
    );

    let messageDefinitions: MessageDefinitions;
    if (this.datatypes || this.parsedMessageDefinitionsByTopic) {
      messageDefinitions = {
        type: "parsed",
        datatypes: this.datatypes ?? new Map(),
        parsedMessageDefinitionsByTopic: this.parsedMessageDefinitionsByTopic ?? {},
        messageDefinitionsByTopic: this.messageDefinitionsByTopic,
      };
    } else {
      messageDefinitions = {
        type: "raw",
        messageDefinitionsByTopic: this.messageDefinitionsByTopic,
      };
    }

    const firstSortedMessage = sortedMessages[0];
    const lastReceiveTime = last(sortedMessages)?.receiveTime;
    if (!lastReceiveTime || !firstSortedMessage) {
      throw new Error("MemoryDataProvider invariant: no sorted messages");
    }

    return {
      start: firstSortedMessage.receiveTime,
      end: lastReceiveTime,
      topics: this.topics ?? [],
      topicStats: this.topicStats,
      connections: [],
      messageDefinitions,
      providesParsedMessages: this.providesParsedMessages,
      profile: this.profile,
      problems: [],
    };
  }

  public async close(): Promise<void> {
    // no-op
  }

  public async getMessages(
    start: Time,
    end: Time,
    topics: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    return {
      parsedMessages: filterMessages(
        start,
        end,
        topics.parsedMessages ?? [],
        this.messages.parsedMessages,
      ),
      encodedMessages: filterMessages(
        start,
        end,
        topics.encodedMessages ?? [],
        this.messages.encodedMessages,
      ),
    };
  }
}
