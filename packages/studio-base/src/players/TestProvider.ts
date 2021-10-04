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

import { Time } from "@foxglove/rostime";
import { Topic } from "@foxglove/studio-base/players/types";
import {
  ExtensionPoint,
  InitializationResult,
  RandomAccessDataProvider,
  GetMessagesResult,
  GetMessagesTopics,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

const defaultStart = { sec: 10, nsec: 0 };
const defaultEnd = { sec: 100, nsec: 0 };
const datatypes: RosDatatypes = new Map(
  Object.entries({
    fooBar: {
      definitions: [
        {
          name: "val",
          type: "number",
        },
      ],
    },
    baz: {
      definitions: [
        {
          name: "val",
          type: "number",
        },
      ],
    },
  }),
);
const defaultTopics: Topic[] = [
  { name: "/foo/bar", datatype: "fooBar" },
  { name: "/baz", datatype: "baz" },
];
type GetMessages = (
  start: Time,
  end: Time,
  topics: GetMessagesTopics,
) => Promise<GetMessagesResult>;

// ts-prune-ignore-next
export default class TestProvider implements RandomAccessDataProvider {
  private _start: Time;
  private _end: Time;
  private _topics: Topic[];
  private _datatypes: RosDatatypes;
  extensionPoint?: ExtensionPoint;
  closed: boolean = false;

  constructor({ getMessages, topics }: { getMessages?: GetMessages; topics?: Topic[] } = {}) {
    this._start = defaultStart;
    this._end = defaultEnd;
    this._topics = topics ?? defaultTopics;
    this._datatypes = datatypes;
    if (getMessages) {
      this.getMessages = getMessages;
    }
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    this.extensionPoint = extensionPoint;
    return {
      start: this._start,
      end: this._end,
      topics: this._topics,
      connections: [],
      providesParsedMessages: true,
      messageDefinitions: {
        type: "parsed",
        datatypes: this._datatypes,
        messageDefinitionsByTopic: {},
        parsedMessageDefinitionsByTopic: {},
      },
      problems: [],
    };
  }

  getMessages: GetMessages = async (
    _start: Time,
    _end: Time,
    _topics: GetMessagesTopics,
  ): Promise<GetMessagesResult> => {
    throw new Error("not implemented");
  };

  async close(): Promise<void> {
    this.closed = true;
  }
}
