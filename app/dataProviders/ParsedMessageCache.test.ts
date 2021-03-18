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

import assert from "assert";
import { MessageReader, parseMessageDefinition } from "rosbag";

import BagDataProvider from "@foxglove-studio/app/dataProviders/BagDataProvider";
import ParsedMessageCache, {
  CACHE_SIZE_BYTES,
} from "@foxglove-studio/app/dataProviders/ParsedMessageCache";
import { cast, NotifyPlayerManagerReplyData } from "@foxglove-studio/app/players/types";
import { BinaryHeader } from "@foxglove-studio/app/types/BinaryMessages";
import { getObject, wrapJsObject } from "@foxglove-studio/app/util/binaryObjects";
import { definitions } from "@foxglove-studio/app/util/binaryObjects/messageDefinitionTestTypes";

describe("parsedMessageCache", () => {
  it("does some basic caching of messages", async () => {
    const file = `${__dirname}/../test/fixtures/example.bag`;
    const provider = new BagDataProvider({ bagPath: { type: "file", file } }, []);
    const { messageDefinitions } = await provider.initialize({
      progressCallback: () => {
        // no-op
      },
      reportMetadataCallback: () => {
        // no-op
      },
      notifyPlayerManager: async (): Promise<NotifyPlayerManagerReplyData | undefined> => {
        // no-op
        return;
      },
    });
    if (messageDefinitions.type !== "raw") {
      throw new Error("BagDataProvider should have raw message definitions");
    }
    const tfDefinition = messageDefinitions.messageDefinitionsByTopic["/tf"];
    const parsedTfDefinition = parseMessageDefinition(tfDefinition);
    const messageReadersByTopic = {
      "/tf": new MessageReader(parsedTfDefinition),
    };
    const start = { sec: 1396293887, nsec: 844783943 };
    const end = { sec: 1396293888, nsec: 60000000 };
    const { rosBinaryMessages } = await provider.getMessages(start, end, {
      rosBinaryMessages: ["/tf"],
    });
    assert(rosBinaryMessages);
    const cache = new ParsedMessageCache();
    const parsedMessages1 = cache.parseMessages(rosBinaryMessages, messageReadersByTopic);
    const parsedMessages2 = cache.parseMessages(rosBinaryMessages, messageReadersByTopic);
    expect(parsedMessages1[0]).toBe(parsedMessages2[0]);
    expect(parsedMessages1[1]).toBe(parsedMessages2[1]);
  });

  it("evicts parsed messages based on original message size", async () => {
    const smallMessage = {
      topic: "/some_topic",
      receiveTime: { sec: 100, nsec: 0 },
      message: new ArrayBuffer(10),
    };
    const bigMessage = {
      topic: "/some_topic",
      receiveTime: { sec: 105, nsec: 0 },
      message: new ArrayBuffer(CACHE_SIZE_BYTES + 1),
    };
    const messageReadersByTopic = { "/some_topic": new MessageReader(parseMessageDefinition("")) };

    const cache = new ParsedMessageCache();
    const [parsedSmallMessage1] = cache.parseMessages([smallMessage], messageReadersByTopic);
    const [parsedSmallMessage2] = cache.parseMessages([smallMessage], messageReadersByTopic);
    cache.parseMessages([bigMessage], messageReadersByTopic);
    const [parsedSmallMessage3] = cache.parseMessages([smallMessage], messageReadersByTopic);
    expect(parsedSmallMessage1).toBe(parsedSmallMessage2);
    expect(parsedSmallMessage1).not.toBe(parsedSmallMessage3);
  });

  it("evicts parsed bobjects based on original message size", async () => {
    const smallMessage = {
      topic: "/some_topic",
      receiveTime: { sec: 100, nsec: 0 },
      message: getObject({}, "time", new ArrayBuffer(10), ""),
    };
    const bigMessage = {
      topic: "/some_topic",
      receiveTime: { sec: 105, nsec: 0 },
      message: getObject({}, "time", new ArrayBuffer(CACHE_SIZE_BYTES + 1), ""),
    };
    const messageReadersByTopic = { "/some_topic": new MessageReader(parseMessageDefinition("")) };

    const cache = new ParsedMessageCache();
    const [parsedSmallMessage1] = cache.parseMessages([smallMessage], messageReadersByTopic);
    const [parsedSmallMessage2] = cache.parseMessages([smallMessage], messageReadersByTopic);
    cache.parseMessages([bigMessage], messageReadersByTopic);
    const [parsedSmallMessage3] = cache.parseMessages([smallMessage], messageReadersByTopic);
    expect(parsedSmallMessage1).toBe(parsedSmallMessage2);
    expect(parsedSmallMessage1).not.toBe(parsedSmallMessage3);
  });

  it("can parse bobjects", async () => {
    const binaryHeader = getObject(definitions, "std_msgs/Header", new ArrayBuffer(100), "");
    // Looks like a binary object:
    expect(cast<BinaryHeader>(binaryHeader).frame_id()).toBe("");
    const binaryMessage = {
      topic: "/some_topic",
      receiveTime: { sec: 105, nsec: 0 },
      message: binaryHeader,
    };

    const messageReadersByTopic = { "/some_topic": new MessageReader(parseMessageDefinition("")) };
    const cache = new ParsedMessageCache();
    const [parsedMessage] = cache.parseMessages([binaryMessage], messageReadersByTopic);
    expect(parsedMessage).toEqual({
      topic: "/some_topic",
      receiveTime: { sec: 105, nsec: 0 },
      message: {
        stamp: { sec: 0, nsec: 0 },
        frame_id: "",
        seq: 0,
      },
    });
  });

  it("can parse reverse-wrapped objects", async () => {
    const wrappedHeader = wrapJsObject(definitions, "std_msgs/Header", {
      stamp: { sec: 0, nsec: 0 },
      seq: 0,
      frame_id: "",
    });
    // Looks like a binary object:
    expect(cast<BinaryHeader>(wrappedHeader).frame_id()).toBe("");
    const wrappedMessage = {
      topic: "/some_topic",
      receiveTime: { sec: 105, nsec: 0 },
      message: wrappedHeader,
    };

    const messageReadersByTopic = { "/some_topic": new MessageReader(parseMessageDefinition("")) };
    const cache = new ParsedMessageCache();
    const [parsedMessage] = cache.parseMessages([wrappedMessage as any], messageReadersByTopic);
    expect(parsedMessage).toEqual({
      topic: "/some_topic",
      receiveTime: { sec: 105, nsec: 0 },
      message: {
        stamp: { sec: 0, nsec: 0 },
        frame_id: "",
        seq: 0,
      },
    });
  });
});
