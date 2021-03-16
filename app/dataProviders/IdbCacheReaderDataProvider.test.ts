// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import MemoryDataProvider from "@foxglove-studio/app/dataProviders/MemoryDataProvider";
import { CoreDataProviders } from "@foxglove-studio/app/dataProviders/constants";
import { mockExtensionPoint } from "@foxglove-studio/app/dataProviders/mockExtensionPoint";
import { TypedMessage } from "@foxglove-studio/app/players/types";
import { getDatabasesInTests } from "@foxglove-studio/app/util/indexeddb/getDatabasesInTests";

import IdbCacheReaderDataProvider from "./IdbCacheReaderDataProvider";
import IdbCacheWriterDataProvider from "./IdbCacheWriterDataProvider";

function generateMessages(): TypedMessage<ArrayBuffer>[] {
  return [
    { topic: "/foo", receiveTime: { sec: 100, nsec: 0 }, message: new ArrayBuffer(1) },
    { topic: "/foo", receiveTime: { sec: 101, nsec: 0 }, message: new ArrayBuffer(2) },
    { topic: "/foo", receiveTime: { sec: 102, nsec: 0 }, message: new ArrayBuffer(3) },
  ];
}

function getProvider() {
  return new IdbCacheReaderDataProvider(
    { id: "some-id" },
    [{ name: CoreDataProviders.IdbCacheWriterDataProvider, args: {}, children: [] }],
    () =>
      new IdbCacheWriterDataProvider(
        { id: "some-id" },
        [{ name: CoreDataProviders.MemoryCacheDataProvider, args: {}, children: [] }],
        () =>
          new MemoryDataProvider({
            messages: {
              rosBinaryMessages: generateMessages(),
              bobjects: undefined,
              parsedMessages: undefined,
            },
          }),
      ),
  );
}

describe("IdbCacheReaderDataProvider", () => {
  afterEach(() => {
    getDatabasesInTests().clear();
  });

  it("initializes", async () => {
    const provider = getProvider();
    expect(await provider.initialize(mockExtensionPoint().extensionPoint)).toEqual({
      start: { nsec: 0, sec: 100 },
      end: { nsec: 0, sec: 102 },
      topics: [],
      messageDefinitions: {
        type: "raw",
        messageDefinitionsByTopic: {},
      },
      providesParsedMessages: false,
    });
  });

  it("returns messages", async () => {
    const provider = getProvider();
    await provider.initialize(mockExtensionPoint().extensionPoint);
    const messages = await provider.getMessages(
      { sec: 100, nsec: 0 },
      { sec: 102, nsec: 0 },
      { rosBinaryMessages: ["/foo"] },
    );
    expect(messages.bobjects).toBe(undefined);
    expect(messages.parsedMessages).toBe(undefined);
    expect(messages.rosBinaryMessages).toEqual(generateMessages());
  });
});
