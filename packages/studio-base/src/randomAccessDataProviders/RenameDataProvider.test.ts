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
import RenameDataProvider from "@foxglove/studio-base/randomAccessDataProviders/RenameDataProvider";
import { mockExtensionPoint } from "@foxglove/studio-base/randomAccessDataProviders/mockExtensionPoint";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";

// reusable providers
function getProvider() {
  const messages = {
    parsedMessages: [
      { topic: "/some_topic1", receiveTime: { sec: 101, nsec: 0 }, message: { value: 1 } },
      { topic: "/some_topic1", receiveTime: { sec: 103, nsec: 0 }, message: { value: 3 } },
    ],
    rosBinaryMessages: undefined,
  };
  return new MemoryDataProvider({
    messages,
    topics: [{ name: "/some_topic1", datatype: "some_datatype" }],
    providesParsedMessages: true,
    messageDefinitionsByTopic: { "/some_topic1": "int32 value" },
  });
}

function getRenameDataProvider(provider: any, prefix: any) {
  return new RenameDataProvider({ prefix }, [provider], (child: any) => child);
}

describe("RenameDataProvider", () => {
  it("throws if a prefix does not have a leading forward slash", () => {
    expect(() => getRenameDataProvider(getProvider(), "foo")).toThrow();
  });

  it("renames initialization data", async () => {
    const provider = getRenameDataProvider(getProvider(), SECOND_SOURCE_PREFIX);
    expect(await provider.initialize(mockExtensionPoint().extensionPoint)).toEqual({
      start: { nsec: 0, sec: 101 },
      end: { nsec: 0, sec: 103 },
      connections: [],
      topics: [
        {
          datatype: "some_datatype",
          name: `${SECOND_SOURCE_PREFIX}/some_topic1`,
          originalTopic: "/some_topic1",
        },
      ],
      messageDefinitions: {
        type: "raw",
        messageDefinitionsByTopic: { [`${SECOND_SOURCE_PREFIX}/some_topic1`]: "int32 value" },
      },
      numMessages: undefined,
      providesParsedMessages: true,
      problems: [],
    });
  });

  it("renames initialization data - parsed message definitions", async () => {
    const baseProvider = getProvider();
    baseProvider.parsedMessageDefinitionsByTopic = { "/some_topic1": [] };
    const provider = getRenameDataProvider(baseProvider, SECOND_SOURCE_PREFIX);
    expect(await provider.initialize(mockExtensionPoint().extensionPoint)).toEqual({
      start: { nsec: 0, sec: 101 },
      end: { nsec: 0, sec: 103 },
      connections: [],
      topics: [
        {
          datatype: "some_datatype",
          name: `${SECOND_SOURCE_PREFIX}/some_topic1`,
          originalTopic: "/some_topic1",
        },
      ],
      messageDefinitions: {
        type: "parsed",
        messageDefinitionsByTopic: { [`${SECOND_SOURCE_PREFIX}/some_topic1`]: "int32 value" },
        datatypes: {},
        parsedMessageDefinitionsByTopic: { [`${SECOND_SOURCE_PREFIX}/some_topic1`]: [] },
      },
      numMessages: undefined,
      providesParsedMessages: true,
      problems: [],
    });
  });

  it("adds the prefix to streamed message topics", async () => {
    const provider = getRenameDataProvider(getProvider(), SECOND_SOURCE_PREFIX);
    await provider.initialize(mockExtensionPoint().extensionPoint);
    const result = await provider.getMessages(
      { sec: 101, nsec: 0 },
      { sec: 103, nsec: 0 },
      { parsedMessages: [`${SECOND_SOURCE_PREFIX}/some_topic1`] },
    );
    expect(result.rosBinaryMessages).toBe(undefined);
    expect(result.parsedMessages).toEqual([
      {
        message: { value: 1 },
        receiveTime: { nsec: 0, sec: 101 },
        topic: `${SECOND_SOURCE_PREFIX}/some_topic1`,
      },
      {
        message: { value: 3 },
        receiveTime: { nsec: 0, sec: 103 },
        topic: `${SECOND_SOURCE_PREFIX}/some_topic1`,
      },
    ]);
  });
  it("calls progressCallback with the progress data passed from child provider", async () => {
    const provider = getProvider();
    const combinedProvider = getRenameDataProvider(provider, "/generic_topic");
    const extensionPoint = mockExtensionPoint().extensionPoint;
    const mockProgressCallback = jest.spyOn(extensionPoint, "progressCallback");
    await combinedProvider.initialize(extensionPoint);
    provider.extensionPoint?.progressCallback({
      fullyLoadedFractionRanges: [{ start: 0, end: 0.5 }],
      messageCache: {
        startTime: { sec: 100, nsec: 0 },
        blocks: [
          {
            sizeInBytes: 0,
            messagesByTopic: {},
          },
          {
            sizeInBytes: 99,
            messagesByTopic: {
              "/some_topic1": [
                {
                  topic: "/some_topic1",
                  receiveTime: { sec: 101, nsec: 0 },
                  message: { sec: 0, nsec: 0 },
                },
              ],
            },
          },
        ],
      },
    });
    const calls = mockProgressCallback.mock.calls;
    expect(calls[calls.length - 1]).toEqual([
      {
        fullyLoadedFractionRanges: [{ start: 0, end: 0.5 }],
        messageCache: {
          startTime: { sec: 100, nsec: 0 },
          blocks: [
            {
              sizeInBytes: 0,
              messagesByTopic: {},
            },
            {
              sizeInBytes: 99,
              messagesByTopic: {
                "/generic_topic/some_topic1": [
                  expect.objectContaining({
                    receiveTime: { sec: 101, nsec: 0 },
                    topic: "/generic_topic/some_topic1",
                  }),
                ],
              },
            },
          ],
        },
      },
    ]);
  });

  it("preserves block identity across successive calls", async () => {
    const provider = getProvider();
    const combinedProvider = getRenameDataProvider(provider, "/generic_topic");
    const extensionPoint = mockExtensionPoint().extensionPoint;
    const mockProgressCallback = jest.spyOn(extensionPoint, "progressCallback");
    await combinedProvider.initialize(extensionPoint);

    const blocks = [{ sizeInBytes: 99, messagesByTopic: { "/some_topic1": [] } }];
    provider.extensionPoint?.progressCallback({
      fullyLoadedFractionRanges: [{ start: 0, end: 0.5 }],
      messageCache: { startTime: { sec: 100, nsec: 0 }, blocks },
    });
    provider.extensionPoint?.progressCallback({
      fullyLoadedFractionRanges: [{ start: 0, end: 0.5 }],
      messageCache: { startTime: { sec: 100, nsec: 0 }, blocks },
    });

    const calls = mockProgressCallback.mock.calls;
    expect(calls.length).toBe(3); // once on init, once per call.
    const cache1 = calls[1]![0].messageCache;
    const blocks1 = cache1?.blocks;
    const cache2 = calls[2]![0].messageCache;
    const blocks2 = cache2?.blocks;
    expect(cache1).not.toBe(cache2);
    expect(cache1).toEqual(cache2);
    expect(blocks1).not.toBe(blocks2);
    expect(blocks1?.length).toBe(1);
    expect(blocks1![0]).toBe(blocks2![0]);
  });

  it("can preserve cache identity across successive calls", async () => {
    const provider = getProvider();
    const combinedProvider = getRenameDataProvider(provider, "/generic_topic");
    const extensionPoint = mockExtensionPoint().extensionPoint;
    const mockProgressCallback = jest.spyOn(extensionPoint, "progressCallback");
    await combinedProvider.initialize(extensionPoint);

    const messageCache = {
      startTime: { sec: 100, nsec: 0 },
      blocks: [{ sizeInBytes: 99, messagesByTopic: { "/some_topic1": [] } }],
    };
    provider.extensionPoint?.progressCallback({
      fullyLoadedFractionRanges: [{ start: 0, end: 0.5 }],
      messageCache,
    });
    provider.extensionPoint?.progressCallback({
      fullyLoadedFractionRanges: [{ start: 0, end: 0.5 }],
      messageCache,
    });

    const calls = mockProgressCallback.mock.calls;
    expect(calls.length).toBe(3); // once on init, once per call.
    const cache1 = calls[1]![0].messageCache;
    const cache2 = calls[2]![0].messageCache;
    expect(cache1).toBe(cache2);
  });
});
