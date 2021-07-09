/** @jest-environment jsdom */
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

import MemoryDataProvider from "@foxglove/studio-base/randomAccessDataProviders/MemoryDataProvider";
import { mockExtensionPoint } from "@foxglove/studio-base/randomAccessDataProviders/mockExtensionPoint";
import { RandomAccessDataProviderMetadata } from "@foxglove/studio-base/randomAccessDataProviders/types";
import Rpc, { createLinkedChannels } from "@foxglove/studio-base/util/Rpc";

import RpcDataProvider from "./RpcDataProvider";
import RpcDataProviderRemote from "./RpcDataProviderRemote";

const data = {
  messages: {
    rosBinaryMessages: [
      { topic: "/some_topic", receiveTime: { sec: 100, nsec: 0 }, message: new ArrayBuffer(0) },
      { topic: "/some_topic", receiveTime: { sec: 101, nsec: 0 }, message: new ArrayBuffer(0) },
      { topic: "/some_topic", receiveTime: { sec: 102, nsec: 0 }, message: new ArrayBuffer(0) },
    ],
    parsedMessages: undefined,
  },
  topics: [{ name: "/some_topic", datatype: "some_datatype" }],
  messageDefinitionsByTopic: { some_datatype: "dummy" },
  providesParsedMessages: false,
};
const dummyChildren = [{ name: "MemoryDataProvider", args: {}, children: [] }];

describe("RpcDataProvider", () => {
  it("passes the initialization result through the Rpc channel", async () => {
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const provider = new RpcDataProvider(new Rpc(mainChannel), dummyChildren);
    const memoryDataProvider = new MemoryDataProvider(data);
    new RpcDataProviderRemote(new Rpc(workerChannel), () => memoryDataProvider);

    expect(await provider.initialize(mockExtensionPoint().extensionPoint)).toEqual({
      connections: [],
      start: { nsec: 0, sec: 100 },
      end: { nsec: 0, sec: 102 },
      topics: [{ datatype: "some_datatype", name: "/some_topic" }],
      messageDefinitions: {
        type: "raw",
        messageDefinitionsByTopic: { some_datatype: "dummy" },
      },
      providesParsedMessages: false,
      problems: [],
    });
  });

  it("passes messages with ArrayBuffers through the Rpc channel", async () => {
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const provider = new RpcDataProvider(new Rpc(mainChannel), dummyChildren);
    const memoryDataProvider = new MemoryDataProvider(data);
    new RpcDataProviderRemote(new Rpc(workerChannel), () => memoryDataProvider);

    await provider.initialize(mockExtensionPoint().extensionPoint);
    const messages = await provider.getMessages(
      { sec: 100, nsec: 0 },
      { sec: 101, nsec: 0 },
      { rosBinaryMessages: ["/some_topic"] },
    );
    expect(messages.parsedMessages).toBe(undefined);
    expect(messages.rosBinaryMessages).toEqual([
      data.messages.rosBinaryMessages[0],
      data.messages.rosBinaryMessages[1],
    ]);
  });

  it("passes calls to extensionPoint.reportMetadataCallback through the Rpc channel", async () => {
    const extensionPoint = {
      progressCallback() {
        // no-op
      },
      reportMetadataCallback: jest.fn(),
    };
    const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
    const provider = new RpcDataProvider(new Rpc(mainChannel), dummyChildren);
    const memoryDataProvider = new MemoryDataProvider(data);
    new RpcDataProviderRemote(new Rpc(workerChannel), () => memoryDataProvider);
    const metadata: RandomAccessDataProviderMetadata = {
      type: "updateReconnecting",
      reconnecting: true,
    };

    await provider.initialize(extensionPoint);
    if (!memoryDataProvider.extensionPoint) {
      throw new Error("memoryDataProvider.extensionPoint should be set");
    }
    memoryDataProvider.extensionPoint.reportMetadataCallback(metadata);
    expect(extensionPoint.reportMetadataCallback.mock.calls[0][0]).toEqual(metadata);
  });
});
