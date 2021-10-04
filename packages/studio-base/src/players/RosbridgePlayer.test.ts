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

import { Time } from "@foxglove/rostime";
import NoopMetricsCollector from "@foxglove/studio-base/players/NoopMetricsCollector";
import RosbridgePlayer from "@foxglove/studio-base/players/RosbridgePlayer";

const headerMessage = ({
  seq,
  stamp: { sec, nsec },
  frame_id,
}: {
  seq: number;
  stamp: Time;
  frame_id: string;
}) => {
  const bytes = Buffer.alloc(16 + frame_id.length);
  bytes.writeUInt32LE(seq, 0);
  bytes.writeUInt32LE(sec, 4);
  bytes.writeUInt32LE(nsec, 8);
  bytes.writeUInt32LE(frame_id.length, 12);
  bytes.write(frame_id, 16);
  return { bytes };
};

const textMessage = ({ text }: { text: string }) => {
  const bytes = Buffer.alloc(4 + text.length);
  bytes.writeUInt32LE(text.length, 0);
  bytes.write(text, 4);
  return { bytes };
};

let workerInstance: MockRosClient;
class MockRosClient {
  constructor() {
    workerInstance = this;
  }

  private _topics: string[] = [];
  private _types: string[] = [];
  private _typedefs_full_text: string[] = [];
  private _connectCallback?: () => void;
  private _messages: any[] = [];

  setup({
    topics = [],
    types = [],
    typedefs = [],
    messages = [],
  }: {
    topics?: string[];
    types?: string[];
    typedefs?: string[];
    messages?: any[];
  }) {
    this._topics = topics;
    this._types = types;
    this._typedefs_full_text = typedefs;
    this._messages = messages;

    this._connectCallback?.();
  }

  on(op: string, callback: () => void) {
    if (op === "connection") {
      this._connectCallback = callback;
    }
  }

  close() {
    // no-op
  }

  getTopicsAndRawTypes(callback: (...args: unknown[]) => void) {
    callback({
      topics: this._topics,
      types: this._types,
      typedefs_full_text: this._typedefs_full_text,
    });
  }

  getMessagesByTopicName(topicName: string): { message: unknown }[] {
    return this._messages.filter(({ topic }) => topic === topicName);
  }

  getNodes(callback: (nodes: string[]) => void, _errCb: (error: Error) => void) {
    callback([]);
  }

  getNodeDetails(
    _node: string,
    callback: (subscriptions: string[], publications: string[], services: string[]) => void,
    _errCb: (error: Error) => void,
  ) {
    callback([], [], []);
  }
}

class MockRosTopic {
  private _name: string = "";

  constructor({ name }: { name: string }) {
    this._name = name;
  }

  subscribe(callback: (arg: unknown) => void) {
    workerInstance.getMessagesByTopicName(this._name).forEach(({ message }) => callback(message));
  }
}

jest.mock("roslib", () => {
  return {
    __esModule: true,
    default: {
      Ros: jest.fn(() => new MockRosClient()),
      Topic: jest.fn((arg) => new MockRosTopic(arg)),
    },
  };
});

describe("RosbridgePlayer", () => {
  let player: RosbridgePlayer;

  beforeEach(() => {
    player = new RosbridgePlayer({
      url: "ws://some-url",
      metricsCollector: new NoopMetricsCollector(),
    });
  });

  afterEach(() => {
    player.close();
  });

  it("subscribes to topics without errors", (done) => {
    workerInstance.setup({
      topics: ["/topic/A"],
      types: ["/std_msgs/Header"],
      typedefs: [
        `std_msgs/Header header

      ================================================================================
      MSG: std_msgs/Header
      uint32 seq
      time stamp
      string frame_id`,
      ],
    });

    player.setSubscriptions([{ topic: "/topic/A" }]);
    player.setListener(async ({ activeData }) => {
      const { topics } = activeData ?? {};
      if (!topics) {
        return;
      }

      expect(topics).toStrictEqual([{ name: "/topic/A", datatype: "/std_msgs/Header" }]);
      done();
    });
  });

  describe("parsedMessages", () => {
    beforeEach(() => {
      workerInstance.setup({
        topics: ["/topic/A", "/topic/B"],
        types: ["/std_msgs/Header", "text"],
        typedefs: [
          `std_msgs/Header header

            ================================================================================
            MSG: std_msgs/Header
            uint32 seq
            time stamp
            string frame_id`,
          `string text`,
        ],
        messages: [
          {
            topic: "/topic/A",
            receiveTime: { sec: 100, nsec: 0 },
            message: headerMessage({
              seq: 7643,
              stamp: { sec: 1234, nsec: 5678 },
              frame_id: "someFrameId",
            }),
          },
          {
            topic: "/topic/B",
            receiveTime: { sec: 100, nsec: 0 },
            message: textMessage({ text: "some text" }),
          },
        ],
      });
    });

    it("returns parsedMessages with complex type", (done) => {
      player.setSubscriptions([{ topic: "/topic/A" }]);

      player.setListener(async ({ activeData }) => {
        const { messages } = activeData ?? {};
        if (!messages) {
          return;
        }

        expect(messages.length).toBe(1);
        expect(messages[0]?.message).toMatchObject({
          header: {
            seq: 7643,
            stamp: { sec: 1234, nsec: 5678 },
            frame_id: "someFrameId",
          },
        });

        done();
      });
    });

    it("returns parsedMessages with basic types", (done) => {
      player.setSubscriptions([{ topic: "/topic/B" }]);

      player.setListener(async ({ activeData }) => {
        const { messages } = activeData ?? {};
        if (!messages) {
          return;
        }

        expect(messages.length).toBe(1);
        expect(messages[0]?.message).toMatchObject({
          text: "some text",
        });

        done();
      });
    });
  });
});
