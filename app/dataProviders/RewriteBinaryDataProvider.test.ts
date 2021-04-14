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

import { flatten } from "lodash";
import { TimeUtil } from "rosbag";

import MemoryDataProvider from "@foxglove-studio/app/dataProviders/MemoryDataProvider";
import RewriteBinaryDataProvider from "@foxglove-studio/app/dataProviders/RewriteBinaryDataProvider";
import { mockExtensionPoint } from "@foxglove-studio/app/dataProviders/mockExtensionPoint";
import { Message, TypedMessage } from "@foxglove-studio/app/players/types";
import { isBobject } from "@foxglove-studio/app/util/binaryObjects";
import naturalSort from "@foxglove-studio/app/util/naturalSort";

function sortMessages(messages: Message[]) {
  return messages.sort(
    (a, b) => TimeUtil.compare(a.receiveTime, b.receiveTime) || naturalSort()(a.topic, b.topic),
  );
}

function generateMessages(): TypedMessage<ArrayBuffer>[] {
  return sortMessages([
    { topic: "/foo", receiveTime: { sec: 100, nsec: 0 }, message: new ArrayBuffer(10) },
    { topic: "/foo", receiveTime: { sec: 101, nsec: 0 }, message: new ArrayBuffer(10) },
    { topic: "/foo", receiveTime: { sec: 102, nsec: 0 }, message: new ArrayBuffer(10) },
    { topic: "/bar", receiveTime: { sec: 100, nsec: 0 }, message: new ArrayBuffer(10) },
    { topic: "/bar", receiveTime: { sec: 101, nsec: 0 }, message: new ArrayBuffer(10) },
    { topic: "/bar", receiveTime: { sec: 102, nsec: 0 }, message: new ArrayBuffer(10) },
  ]);
}

function getProvider(rosBinaryMessages: TypedMessage<ArrayBuffer>[]) {
  const messages = { parsedMessages: undefined, rosBinaryMessages, bobjects: undefined };
  const memoryDataProvider = new MemoryDataProvider({
    messages,
    providesParsedMessages: false,
    datatypes: { empty: { fields: [] } },
    topics: [
      { name: "/foo", datatype: "empty" },
      { name: "/bar", datatype: "empty" },
    ],
    parsedMessageDefinitionsByTopic: {
      "/foo": [{ definitions: [] }],
      "/bar": [{ definitions: [] }],
    },
  });
  return {
    provider: new RewriteBinaryDataProvider(
      {},
      [{ name: "MemoryDataProvider", args: {}, children: [] }],
      () => memoryDataProvider,
    ),
    memoryDataProvider,
  };
}

describe("RewriteBinaryDataProvider", () => {
  it("initializes", async () => {
    const { provider } = getProvider(generateMessages());
    expect(await provider.initialize(mockExtensionPoint().extensionPoint)).toEqual({
      start: { nsec: 0, sec: 100 },
      end: { nsec: 0, sec: 102 },
      connections: [],
      topics: [
        { name: "/foo", datatype: "empty" },
        { name: "/bar", datatype: "empty" },
      ],
      messageDefinitions: {
        type: "parsed",
        datatypes: { empty: { fields: [] } },
        messageDefinitionsByTopic: {},
        parsedMessageDefinitionsByTopic: {
          "/foo": [{ definitions: [] }],
          "/bar": [{ definitions: [] }],
        },
      },
      providesParsedMessages: false,
    });
  });

  it("returns bobjects messages if enabled", async () => {
    const { provider } = getProvider(generateMessages());
    await provider.initialize(mockExtensionPoint().extensionPoint);
    // Make a bunch of different calls in quick succession and out of order, and stitch them
    // together, to test a bit more thoroughly.
    const results = await Promise.all([
      provider.getMessages({ sec: 102, nsec: 0 }, { sec: 102, nsec: 0 }, { bobjects: ["/foo"] }),
      provider.getMessages(
        { sec: 100, nsec: 0 },
        { sec: 100, nsec: 0 },
        { bobjects: ["/foo", "/bar"] },
      ),
      provider.getMessages(
        { sec: 100, nsec: 1 },
        { sec: 101, nsec: 1e9 - 1 },
        { bobjects: ["/foo"] },
      ),
      provider.getMessages(
        { sec: 100, nsec: 1 },
        { sec: 101, nsec: 1e9 - 1 },
        { bobjects: ["/bar"] },
      ),
      provider.getMessages({ sec: 102, nsec: 0 }, { sec: 102, nsec: 0 }, { bobjects: ["/bar"] }),
    ]);
    const messages = sortMessages(flatten(results.map(({ bobjects }) => bobjects || [])));
    expect(messages).toEqual(
      generateMessages().map(({ topic, receiveTime }) =>
        expect.objectContaining({ topic, receiveTime }),
      ),
    );
    messages.forEach((message) => {
      expect(isBobject(message.message)).toBe(true);
    });
  });
});
