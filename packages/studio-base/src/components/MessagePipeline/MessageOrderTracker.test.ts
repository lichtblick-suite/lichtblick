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

import { MessageEvent, PlayerPresence, PlayerState } from "@foxglove/studio-base/players/types";

import MessageOrderTracker from "./MessageOrderTracker";

let lastSeekTimeCounter = 1;
const lastSeekTime = () => {
  lastSeekTimeCounter += 1;
  return lastSeekTimeCounter;
};

const playerStateWithMessages = (messages: any, messageOrder: any): PlayerState => ({
  presence: PlayerPresence.PRESENT,
  progress: {},
  capabilities: [],
  playerId: "test",
  profile: undefined,
  activeData: {
    topics: [
      { name: "/foo", datatype: "visualization_msgs/Marker" },
      { name: "/bar", datatype: "visualization_msgs/Marker" },
    ],
    topicStats: new Map(),
    datatypes: new Map(),
    currentTime: {
      sec: 1,
      nsec: 11,
    },
    speed: 0.2,
    lastSeekTime: lastSeekTime(),
    startTime: { sec: 0, nsec: 0 },
    endTime: { sec: 2, nsec: 0 },
    isPlaying: false,
    messages,
    messageOrder,
    totalBytesReceived: 1234,
  },
});

const message = (
  headerStampSeconds: number | undefined,
  receiveTimeSeconds: number | undefined,
): MessageEvent<unknown> => ({
  topic: "/foo",
  receiveTime:
    receiveTimeSeconds == undefined ? undefined : ({ sec: receiveTimeSeconds, nsec: 1 } as any),
  message: {
    header:
      headerStampSeconds == undefined ? undefined : { stamp: { sec: headerStampSeconds, nsec: 1 } },
  },
  sizeInBytes: 0,
});

describe("MessagePipeline/MessageOrderTracker", () => {
  describe("when expecting messages ordered by receive time", () => {
    it("report error when messages are out of order", () => {
      const orderTracker = new MessageOrderTracker();
      const problems = orderTracker.update(
        playerStateWithMessages([message(7, 10), message(8, 9)], "receiveTime"),
      );

      expect(problems).toEqual([
        {
          error: new Error(
            "Processed a message on /foo at 9.000000001 which is earlier than last processed message on /foo at 10.000000001.",
          ),
          message: "Data went back in time",
          severity: "warn",
        },
      ]);
    });

    it("does not report an error when messages are in order", () => {
      const orderTracker = new MessageOrderTracker();
      const playerState = playerStateWithMessages([message(8, 9), message(7, 10)], "receiveTime");
      const problems = orderTracker.update(playerState);
      expect(problems).toEqual([]);
    });

    it("reports an error when given a message with no receive time", () => {
      const orderTracker = new MessageOrderTracker();
      const problems = orderTracker.update(
        playerStateWithMessages([message(7, undefined)], "receiveTime"),
      );
      expect(problems).toEqual([
        {
          error: new Error(
            "Received a message on topic /foo around 1.000000011 with no receiveTime.",
          ),
          message: "Unsortable message",
          severity: "warn",
        },
      ]);
    });

    it("reports an error when given a message with no timestamps at all", () => {
      const orderTracker = new MessageOrderTracker();
      const problems = orderTracker.update(
        playerStateWithMessages([message(undefined, undefined)], "receiveTime"),
      );
      expect(problems).toEqual([
        {
          error: new Error(
            "Received a message on topic /foo around 1.000000011 with no receiveTime.",
          ),
          message: "Unsortable message",
          severity: "warn",
        },
      ]);
    });
  });

  describe("when expecting messages ordered by header stamp", () => {
    it("calls report error when messages are out of order", () => {
      const orderTracker = new MessageOrderTracker();
      const problems = orderTracker.update(
        playerStateWithMessages([message(8, 9), message(7, 10)], "headerStamp"),
      );
      expect(problems).toEqual([
        {
          error: new Error(
            "Processed a message on /foo at 7.000000001 which is earlier than last processed message on /foo at 8.000000001.",
          ),
          message: "Data went back in time",
          severity: "warn",
        },
      ]);
    });

    it("does not report an error when messages are in order", () => {
      const orderTracker = new MessageOrderTracker();
      const playerState = playerStateWithMessages([message(7, 10), message(8, 9)], "headerStamp");
      const problems = orderTracker.update(playerState);
      expect(problems).toEqual([]);
    });

    it("reports an error when given a message with no header stamp", () => {
      const orderTracker = new MessageOrderTracker();
      const problems = orderTracker.update(
        playerStateWithMessages([message(undefined, 10)], "headerStamp"),
      );
      expect(problems).toEqual([
        {
          error: new Error(
            "Received a message on topic /foo around 1.000000011 with no headerStamp.",
          ),
          message: "Unsortable message",
          severity: "warn",
        },
      ]);
    });

    it("reports an error when given a message with no timestamps at all", () => {
      const orderTracker = new MessageOrderTracker();
      const problems = orderTracker.update(
        playerStateWithMessages([message(undefined, undefined)], "headerStamp"),
      );
      expect(problems).toEqual([
        {
          error: new Error(
            "Received a message on topic /foo around 1.000000011 with no headerStamp.",
          ),
          message: "Unsortable message",
          severity: "warn",
        },
      ]);
    });

    it("forgives a timestamp-backtracking after a missing header stamp", () => {
      const orderTracker = new MessageOrderTracker();
      const problems = orderTracker.update(
        playerStateWithMessages(
          [
            message(8, 9),
            message(undefined, 10), // one error
            message(3, 4), // not an error
          ],
          "headerStamp",
        ),
      );
      expect(problems).toEqual([
        {
          error: new Error(
            "Received a message on topic /foo around 1.000000011 with no headerStamp.",
          ),
          message: "Unsortable message",
          severity: "warn",
        },
      ]);
    });
  });
});
