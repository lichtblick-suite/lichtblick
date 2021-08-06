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

import assert from "assert";
import fs from "fs";

import { compare } from "@foxglove/rostime";
import BagDataProvider, {
  statsAreAdjacent,
  TimedDataThroughput,
} from "@foxglove/studio-base/randomAccessDataProviders/BagDataProvider";
import sendNotification from "@foxglove/studio-base/util/sendNotification";

const dummyExtensionPoint = {
  progressCallback() {
    // no-op
  },
  reportMetadataCallback() {
    // no-op
  },
};

describe("BagDataProvider", () => {
  it("initializes", async () => {
    const provider = new BagDataProvider(
      {
        bagPath: {
          type: "file",
          file: new Blob([fs.readFileSync(`${__dirname}/../test/fixtures/example.bag`)]),
        },
      },
      [],
    );
    const result = await provider.initialize(dummyExtensionPoint);
    expect(result.start).toEqual({ sec: 1396293887, nsec: 844783943 });
    expect(result.end).toEqual({ sec: 1396293909, nsec: 544870199 });
    expect(result.topics).toContainOnly([
      { datatype: "rosgraph_msgs/Log", name: "/rosout", numMessages: 1 },
      { datatype: "turtlesim/Color", name: "/turtle1/color_sensor", numMessages: 1351 },
      { datatype: "tf2_msgs/TFMessage", name: "/tf_static", numMessages: 1 },
      { datatype: "turtlesim/Color", name: "/turtle2/color_sensor", numMessages: 1344 },
      { datatype: "turtlesim/Pose", name: "/turtle1/pose", numMessages: 1344 },
      { datatype: "turtlesim/Pose", name: "/turtle2/pose", numMessages: 1344 },
      { datatype: "tf/tfMessage", name: "/tf", numMessages: 1344 },
      { datatype: "geometry_msgs/Twist", name: "/turtle2/cmd_vel", numMessages: 208 },
      { datatype: "geometry_msgs/Twist", name: "/turtle1/cmd_vel", numMessages: 357 },
    ]);
    const { messageDefinitions } = result;
    if (messageDefinitions.type !== "raw") {
      throw new Error("BagDataProvider requires raw message definitions");
    }
    expect(Object.keys(messageDefinitions.messageDefinitionsByTopic)).toContainOnly([
      "/rosout",
      "/turtle1/color_sensor",
      "/tf_static",
      "/turtle2/color_sensor",
      "/turtle1/pose",
      "/turtle2/pose",
      "/tf",
      "/turtle2/cmd_vel",
      "/turtle1/cmd_vel",
    ]);
  });

  it("initializes with bz2 bag", async () => {
    const provider = new BagDataProvider(
      {
        bagPath: {
          type: "file",
          file: new Blob([fs.readFileSync(`${__dirname}/../test/fixtures/example-bz2.bag`)]),
        },
      },
      [],
    );
    const result = await provider.initialize(dummyExtensionPoint);
    expect(result.start).toEqual({ sec: 1396293887, nsec: 844783943 });
    expect(result.end).toEqual({ sec: 1396293909, nsec: 544870199 });
    expect(result.topics).toContainOnly([
      { datatype: "rosgraph_msgs/Log", name: "/rosout", numMessages: 10 },
      { datatype: "turtlesim/Color", name: "/turtle1/color_sensor", numMessages: 1351 },
      { datatype: "tf2_msgs/TFMessage", name: "/tf_static", numMessages: 1 },
      { datatype: "turtlesim/Color", name: "/turtle2/color_sensor", numMessages: 1344 },
      { datatype: "turtlesim/Pose", name: "/turtle1/pose", numMessages: 1344 },
      { datatype: "turtlesim/Pose", name: "/turtle2/pose", numMessages: 1344 },
      { datatype: "tf/tfMessage", name: "/tf", numMessages: 2688 },
      { datatype: "geometry_msgs/Twist", name: "/turtle2/cmd_vel", numMessages: 208 },
      { datatype: "geometry_msgs/Twist", name: "/turtle1/cmd_vel", numMessages: 357 },
    ]);
    const { messageDefinitions } = result;
    if (messageDefinitions.type !== "raw") {
      throw new Error("BagDataProvider requires raw message definitions");
    }
    expect(Object.keys(messageDefinitions.messageDefinitionsByTopic)).toContainOnly([
      "/rosout",
      "/turtle1/color_sensor",
      "/tf_static",
      "/turtle2/color_sensor",
      "/turtle1/pose",
      "/turtle2/pose",
      "/tf",
      "/turtle2/cmd_vel",
      "/turtle1/cmd_vel",
    ]);
  });

  it("gets messages", async () => {
    const provider = new BagDataProvider(
      {
        bagPath: {
          type: "file",
          file: new Blob([fs.readFileSync(`${__dirname}/../test/fixtures/example.bag`)]),
        },
      },
      [],
    );
    await provider.initialize(dummyExtensionPoint);
    const start = { sec: 1396293887, nsec: 844783943 };
    const end = { sec: 1396293888, nsec: 60000000 };
    const messages = await provider.getMessages(start, end, { rosBinaryMessages: ["/tf"] });
    expect(messages.parsedMessages).toBe(undefined);
    expect(messages.rosBinaryMessages).toEqual([
      {
        topic: "/tf",
        receiveTime: { sec: 1396293888, nsec: 56251251 },
        message: expect.any(ArrayBuffer),
      },
      {
        topic: "/tf",
        receiveTime: { nsec: 56262848, sec: 1396293888 },
        message: expect.any(ArrayBuffer),
      },
    ]);
  });

  it("sorts shuffled messages (and reports an error)", async () => {
    const provider = new BagDataProvider(
      {
        bagPath: {
          type: "file",
          file: new Blob([fs.readFileSync(`${__dirname}/../test/fixtures/demo-shuffled.bag`)]),
        },
      },
      [],
    );
    await provider.initialize(dummyExtensionPoint);
    const start = { sec: 1490148912, nsec: 0 };
    const end = { sec: 1490148913, nsec: 0 };
    const { parsedMessages, rosBinaryMessages } = await provider.getMessages(start, end, {
      rosBinaryMessages: ["/tf"],
    });
    expect(parsedMessages).toBe(undefined);
    expect(rosBinaryMessages).toBeTruthy();
    assert(rosBinaryMessages);
    const timestamps = rosBinaryMessages.map(({ receiveTime }) => receiveTime);
    const sortedTimestamps = [...timestamps];
    sortedTimestamps.sort(compare);
    expect(timestamps).toEqual(sortedTimestamps);
    sendNotification.expectCalledDuringTest();
  });
});

describe("statsAreAdjacent", () => {
  it("returns false when topics have changed", () => {
    const a: TimedDataThroughput = {
      startTime: { sec: 10, nsec: 500 },
      endTime: { sec: 10, nsec: 599 },
      data: {
        type: "average_throughput",
        topics: ["/topic1"],
        totalSizeOfMessages: 10,
        numberOfMessages: 1,
        receivedRangeDuration: { sec: 0, nsec: 100 },
        requestedRangeDuration: { sec: 0, nsec: 100 },
        totalTransferTime: { sec: 0, nsec: 500 },
      },
    };
    const b: TimedDataThroughput = {
      startTime: { sec: 10, nsec: 600 },
      endTime: { sec: 10, nsec: 699 },
      data: {
        type: "average_throughput",
        topics: ["/topic1", "/topic2"],
        totalSizeOfMessages: 10,
        numberOfMessages: 1,
        receivedRangeDuration: { sec: 0, nsec: 100 },
        requestedRangeDuration: { sec: 0, nsec: 100 },
        totalTransferTime: { sec: 0, nsec: 500 },
      },
    };
    expect(statsAreAdjacent(a, b)).toBe(false);
  });

  it("returns false when requests are far away from each other", () => {
    const a: TimedDataThroughput = {
      startTime: { sec: 10, nsec: 500 },
      endTime: { sec: 10, nsec: 599 },
      data: {
        type: "average_throughput",
        topics: ["/topic1"],
        totalSizeOfMessages: 10,
        numberOfMessages: 1,
        receivedRangeDuration: { sec: 0, nsec: 100 },
        requestedRangeDuration: { sec: 0, nsec: 100 },
        totalTransferTime: { sec: 0, nsec: 500 },
      },
    };
    const b: TimedDataThroughput = {
      startTime: { sec: 20, nsec: 600 },
      endTime: { sec: 20, nsec: 699 },
      data: {
        type: "average_throughput",
        topics: ["/topic1"],
        totalSizeOfMessages: 10,
        numberOfMessages: 1,
        receivedRangeDuration: { sec: 0, nsec: 100 },
        requestedRangeDuration: { sec: 0, nsec: 100 },
        totalTransferTime: { sec: 0, nsec: 500 },
      },
    };
    expect(statsAreAdjacent(a, b)).toBe(false);
  });

  it("returns true when stats are adjacent", () => {
    const a: TimedDataThroughput = {
      startTime: { sec: 10, nsec: 500 },
      endTime: { sec: 10, nsec: 599 },
      data: {
        type: "average_throughput",
        topics: ["/topic1"],
        totalSizeOfMessages: 10,
        numberOfMessages: 1,
        receivedRangeDuration: { sec: 0, nsec: 100 },
        requestedRangeDuration: { sec: 0, nsec: 100 },
        totalTransferTime: { sec: 0, nsec: 500 },
      },
    };
    const b: TimedDataThroughput = {
      startTime: { sec: 10, nsec: 600 },
      endTime: { sec: 10, nsec: 699 },
      data: {
        type: "average_throughput",
        topics: ["/topic1"],
        totalSizeOfMessages: 12,
        numberOfMessages: 2,
        receivedRangeDuration: { sec: 0, nsec: 100 },
        requestedRangeDuration: { sec: 0, nsec: 100 },
        totalTransferTime: { sec: 0, nsec: 500 },
      },
    };
    expect(statsAreAdjacent(a, b)).toBe(true);
  });
});
