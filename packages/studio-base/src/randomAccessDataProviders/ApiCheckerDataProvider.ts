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

import { Time, isLessThan } from "@foxglove/rostime";
import {
  CoreDataProviders,
  MESSAGE_FORMATS,
} from "@foxglove/studio-base/randomAccessDataProviders/constants";
import {
  RandomAccessDataProvider,
  RandomAccessDataProviderDescriptor,
  ExtensionPoint,
  GetDataProvider,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import sendNotification from "@foxglove/studio-base/util/sendNotification";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

// We wrap every RandomAccessDataProvider in an ApiCheckerDataProvider to strictly enforce
// the API guarantees. This makes it harder to make mistakes with RandomAccessDataProviders,
// and allows you to rely on these guarantees when writing your own RandomAccessDataProviders
// or Players.
//
// Whenever possible we make these errors not prevent further playback, though
// if the API guarantees are violated, it is likely that the rest of the
// application doesn't work properly either. In any case, we surface the error
// clearly to the user.
//
// We run this in production too since the overhead is minimal and well worth
// the guarantees that this gives us.

export function instrumentTreeWithApiCheckerDataProvider(
  treeRoot: RandomAccessDataProviderDescriptor,
  depth: number = 0,
): RandomAccessDataProviderDescriptor {
  return {
    name: CoreDataProviders.ApiCheckerDataProvider,
    args: { name: `${treeRoot.name}@${depth}`, isRoot: depth === 0 },
    children: [
      {
        ...treeRoot,
        children: treeRoot.children.map((node) =>
          instrumentTreeWithApiCheckerDataProvider(node, depth + 1),
        ),
      },
    ],
  };
}

export default class ApiCheckerDataProvider implements RandomAccessDataProvider {
  private _name: string;
  private _provider?: RandomAccessDataProvider;
  private _initializationResult?: InitializationResult;
  private _topicNames: string[] = [];
  private _closed: boolean = false;
  private _isRoot: boolean;

  constructor(
    args: { name: string; isRoot: boolean },
    children: RandomAccessDataProviderDescriptor[],
    getDataProvider: GetDataProvider,
  ) {
    this._name = args.name;
    this._isRoot = args.isRoot;
    const child = children[0];
    if (children.length !== 1 || !child) {
      this._warn(`Required exactly 1 child, but received ${children.length}`);
      return;
    }
    this._provider = getDataProvider(child);
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    if (this._initializationResult) {
      this._warn("initialize was called for a second time");
    }
    if (!this._provider) {
      throw new Error("Provider not initialized");
    }
    const initializationResult = await this._provider.initialize(extensionPoint);
    this._initializationResult = initializationResult;

    if (initializationResult.topics.length === 0) {
      this._warn(
        "No topics returned at all; should have thrown error instead (with details of why this is happening)",
      );
    }
    if (this._isRoot && initializationResult.messageDefinitions.type !== "parsed") {
      this._warn(
        `Root data provider should return parsed message definitions but instead returned raw`,
      );
    }
    for (const topic of initializationResult.topics) {
      this._topicNames.push(topic.name);
      if (initializationResult.messageDefinitions.type === "raw") {
        if (
          !initializationResult.providesParsedMessages &&
          initializationResult.messageDefinitions.messageDefinitionsByTopic[topic.name] == undefined
        ) {
          this._warn(`Topic "${topic.name}"" not present in messageDefinitionsByTopic`);
        }
      } else {
        if (
          !initializationResult.providesParsedMessages &&
          !initializationResult.messageDefinitions.parsedMessageDefinitionsByTopic[topic.name]
        ) {
          this._warn(`Topic "${topic.name}"" not present in parsedMessageDefinitionsByTopic`);
        }
        if (!initializationResult.messageDefinitions.datatypes.get(topic.datatype)) {
          this._warn(`Topic "${topic.name}" datatype "${topic.datatype}" not present in datatypes`);
        }
      }
    }
    return initializationResult;
  }

  async getMessages(
    start: Time,
    end: Time,
    subscriptions: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    if (!this._provider) {
      throw new Error("Provider not initialized");
    }
    if (!Number.isInteger(start.sec) || !Number.isInteger(start.nsec)) {
      this._warn(`start time ${JSON.stringify(start)} must only contain integers`);
    }
    if (!Number.isInteger(end.sec) || !Number.isInteger(end.nsec)) {
      this._warn(`end time ${JSON.stringify(end)} must only contain integers`);
    }
    const initRes = this._initializationResult;
    if (!initRes) {
      this._warn("getMessages was called before initialize finished");
      // Need to return, otherwise we can't refer to initRes later, and this is a really bad violation anyway.
      return { parsedMessages: undefined, rosBinaryMessages: undefined };
    }
    if (isLessThan(end, start)) {
      this._warn(
        `getMessages end (${formatTimeRaw(end)}) is before getMessages start (${formatTimeRaw(
          start,
        )})`,
      );
    }
    if (isLessThan(start, initRes.start)) {
      this._warn(
        `getMessages start (${formatTimeRaw(start)}) is before global start (${formatTimeRaw(
          initRes.start,
        )})`,
      );
    }
    if (isLessThan(initRes.end, end)) {
      this._warn(
        `getMessages end (${formatTimeRaw(end)}) is after global end (${formatTimeRaw(
          initRes.end,
        )})`,
      );
    }
    if (
      (subscriptions.parsedMessages?.length ?? 0) === 0 &&
      (subscriptions.rosBinaryMessages?.length ?? 0) === 0
    ) {
      this._warn("getMessages was called without any topics");
    }
    for (const messageType of MESSAGE_FORMATS) {
      for (const topic of subscriptions[messageType] ?? []) {
        if (!this._topicNames.includes(topic)) {
          this._warn(
            `Requested topic (${topic}) is not in the list of topics published by "initialize" (${JSON.stringify(
              this._topicNames,
            )})`,
          );
        }
      }
    }

    const providerResult = await this._provider?.getMessages(start, end, subscriptions);

    for (const messageType of MESSAGE_FORMATS) {
      const messages = providerResult[messageType];
      if (messages == undefined) {
        continue;
      }
      const topics = subscriptions[messageType] ?? [];
      let lastTime: Time | undefined;
      for (const message of messages) {
        if (!topics.includes(message.topic)) {
          this._warn(
            `message.topic (${message.topic}) was never requested (${JSON.stringify(topics)})`,
          );
        }
        if (isLessThan(message.receiveTime, start)) {
          this._warn(
            `message.receiveTime (${formatTimeRaw(
              message.receiveTime,
            )}) is before start (${formatTimeRaw(start)})`,
          );
        }
        if (isLessThan(end, message.receiveTime)) {
          this._warn(
            `message.receiveTime (${formatTimeRaw(
              message.receiveTime,
            )}) is after end (${formatTimeRaw(end)})`,
          );
        }
        if (lastTime && isLessThan(message.receiveTime, lastTime)) {
          this._warn(
            `message.receiveTime (${formatTimeRaw(
              message.receiveTime,
            )}) is before previous message receiveTime (${formatTimeRaw(
              lastTime,
            )}) -- messages are not sorted by time`,
          );
        }
        lastTime = message.receiveTime;
      }
    }
    return providerResult;
  }

  async close(): Promise<void> {
    if (!this._initializationResult) {
      this._warn("close was called before initialize finished");
    }
    if (this._closed) {
      this._warn("close was called twice");
    }
    this._closed = true;
    return await this._provider?.close();
  }

  private _warn(message: string): void {
    const prefixedMessage = `ApiCheckerDataProvider(${this._name}): ${message}`;
    sendNotification("Internal data provider assertion failed", prefixedMessage, "app", "warn");

    if (process.env.NODE_ENV !== "production") {
      // In tests and local development, also throw a hard message so we'll be more
      // likely to notice it / fail CI.
      throw Error(`ApiCheckerDataProvider assertion failed: ${prefixedMessage}`);
    }
  }
}
