// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { groupBy } from "lodash";
import { Time, TimeUtil } from "rosbag";

import {
  DataProviderDescriptor,
  DataProvider,
  GetDataProvider,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
} from "@foxglove-studio/app/dataProviders/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { getObjects } from "@foxglove-studio/app/util/binaryObjects";
import { getContentBasedDatatypes } from "@foxglove-studio/app/util/datatypes";
import naturalSort from "@foxglove-studio/app/util/naturalSort";
import sendNotification from "@foxglove-studio/app/util/sendNotification";
import { BinaryMessageWriter } from "@foxglove/rosmsg-bobject";

import rawMessageDefinitionsToParsed from "./rawMessageDefinitionsToParsed";

export default class RewriteBinaryDataProvider implements DataProvider {
  _provider: DataProvider;
  _extensionPoint?: ExtensionPoint;
  _writer?: BinaryMessageWriter;
  _datatypeByTopic: {
    [topic: string]: string;
  } = {};
  _datatypes: RosDatatypes = {};

  constructor(_: any, children: DataProviderDescriptor[], getDataProvider: GetDataProvider) {
    this._provider = getDataProvider(children[0]);
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    this._extensionPoint = extensionPoint;
    const result = await this._provider.initialize({
      ...extensionPoint,
      progressCallback: () => {
        // no-op
      },
    });

    const { topics } = result;
    // If the child message definitions are not parsed, parse them here.
    const messageDefinitions =
      result.messageDefinitions.type === "parsed"
        ? result.messageDefinitions
        : rawMessageDefinitionsToParsed(result.messageDefinitions, topics);

    this._writer = new BinaryMessageWriter();
    await this._writer.initialize();

    try {
      const datatypesByTopic: Record<string, string> = {};
      topics.forEach((topic) => {
        datatypesByTopic[topic.name] = topic.datatype;
      });
      const { fakeDatatypesByTopic, fakeDatatypes } = getContentBasedDatatypes(
        messageDefinitions.messageDefinitionsByTopic,
        messageDefinitions.parsedMessageDefinitionsByTopic,
        datatypesByTopic,
      );
      this._writer.registerDefinitions(fakeDatatypes);
      this._datatypes = fakeDatatypes;
      this._datatypeByTopic = fakeDatatypesByTopic;
    } catch (err) {
      sendNotification(
        "Failed to register type definitions",
        err ? `${err.message} - ${err.stack}` : "<unknown error>",
        "app",
        "error",
      );
    }

    return { ...result, messageDefinitions };
  }

  async getMessages(
    start: Time,
    end: Time,
    subscriptions: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    if (!this._writer) {
      throw new Error("RewriteBinaryDataProvider not initialized");
    }
    const writer = this._writer;

    const { rosBinaryMessages } = await this._provider.getMessages(start, end, {
      rosBinaryMessages: subscriptions.bobjects,
    });

    const bobjects: any[] = [];

    try {
      if (rosBinaryMessages) {
        const messagesByTopic = groupBy(rosBinaryMessages, "topic");
        Object.keys(messagesByTopic).forEach((topic) => {
          const definitionName = this._datatypeByTopic[topic];
          const messages = messagesByTopic[topic];
          const binary = writer.rewriteMessages(definitionName, messages);
          const binaryObjects = getObjects(
            this._datatypes,
            this._datatypeByTopic[topic],
            binary.buffer,
            binary.bigString,
            binary.offsets,
          );
          bobjects.push(
            ...binaryObjects.map((b, i) => ({
              message: b,
              topic,
              receiveTime: messages[i].receiveTime,
            })),
          );
        });
      }
    } catch (err) {
      sendNotification(
        "Failed to write binary objects",
        err ? `${err.message} - ${err.stack}` : "<unknown error>",
        "app",
        "error",
      );
    }

    return {
      bobjects: bobjects.sort(
        (a, b) => TimeUtil.compare(a.receiveTime, b.receiveTime) || naturalSort()(a.topic, b.topic),
      ),
      rosBinaryMessages: undefined,
      parsedMessages: undefined,
    };
  }

  close(): Promise<void> {
    return this._provider.close();
  }
}
