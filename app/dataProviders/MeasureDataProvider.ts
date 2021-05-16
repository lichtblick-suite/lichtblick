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

import { Time } from "rosbag";

import {
  DataProvider,
  DataProviderDescriptor,
  DataProviderMetadata,
  ExtensionPoint,
  GetDataProvider,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
} from "@foxglove-studio/app/dataProviders/types";
import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

// Log to the console how long each `getMessages` call takes.
export default class MeasureDataProvider implements DataProvider {
  _name: string;
  _provider: DataProvider;
  _reportMetadataCallback: (arg0: DataProviderMetadata) => void = () => {
    // no-op
  };

  constructor(
    { name }: { name: string },
    children: DataProviderDescriptor[],
    getDataProvider: GetDataProvider,
  ) {
    const child = children[0];
    if (children.length !== 1 || !child) {
      throw new Error(`Incorrect number of children to MeasureDataProvider: ${children.length}`);
    }
    this._name = name;
    this._provider = getDataProvider(child);
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    this._reportMetadataCallback = extensionPoint.reportMetadataCallback;
    return this._provider.initialize(extensionPoint);
  }

  async getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult> {
    const startMs = Date.now();
    const argsString = `${start.sec}.${start.nsec}, ${end.sec}.${end.nsec}`;
    const result = await this._provider.getMessages(start, end, topics);
    const { parsedMessages, rosBinaryMessages } = result;
    const numMessages = (parsedMessages?.length ?? 0) + (rosBinaryMessages?.length ?? 0);
    log.info(
      `MeasureDataProvider(${this._name}): ${
        Date.now() - startMs
      }ms for ${numMessages} messages from getMessages(${argsString})`,
    );
    return result;
  }

  async close(): Promise<void> {
    return this._provider.close();
  }
}
