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

import BagDataProvider from "@foxglove/studio-base/randomAccessDataProviders/BagDataProvider";
import ParseMessagesDataProvider from "@foxglove/studio-base/randomAccessDataProviders/ParseMessagesDataProvider";
import { CoreDataProviders } from "@foxglove/studio-base/randomAccessDataProviders/constants";
import createGetDataProvider from "@foxglove/studio-base/randomAccessDataProviders/createGetDataProvider";

function getProvider() {
  return new ParseMessagesDataProvider(
    {},
    [
      {
        name: CoreDataProviders.BagDataProvider,
        args: {
          bagPath: { type: "file", file: `${__dirname}/../test/fixtures/example.bag` },
        },
        children: [],
      },
    ],
    createGetDataProvider({ BagDataProvider }),
  );
}

const dummyExtensionPoint = {
  progressCallback() {
    // no-op
  },
  reportMetadataCallback() {
    // no-op
  },
};

// prior to updating MemoryCacheDataProvider to lazy messages, ParseMessageDataProvider expended to query its child
// with rosBinaryMessages topics and do the parsing itself. Since MemoryCacheDataProvider uses lazy messages
// this is no longer necessary behavior and ParseMessageDataProvider is a passthrough.
// eslint-disable-next-line jest/no-disabled-tests
describe.skip("ParseMessagesDataProvider", () => {
  it("initializes", async () => {
    const provider = getProvider();
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
    if (messageDefinitions.type !== "parsed") {
      throw new Error("ParseMessagesDataProvider should return parsed message definitions");
    }
    expect(Object.keys(messageDefinitions.datatypes)).toContainOnly([
      "rosgraph_msgs/Log",
      "std_msgs/Header",
      "turtlesim/Color",
      "tf2_msgs/TFMessage",
      "geometry_msgs/TransformStamped",
      "geometry_msgs/Transform",
      "geometry_msgs/Vector3",
      "geometry_msgs/Quaternion",
      "turtlesim/Pose",
      "tf/tfMessage",
      "geometry_msgs/Twist",
    ]);
  });

  it("gets messages", async () => {
    const provider = getProvider();
    await provider.initialize(dummyExtensionPoint);
    const start = { sec: 1396293887, nsec: 844783943 };
    const end = { sec: 1396293888, nsec: 60000000 };
    const messages = await provider.getMessages(start, end, {
      parsedMessages: ["/tf"],
    });
    expect(messages.rosBinaryMessages).toBe(undefined);
    expect(messages.parsedMessages).toHaveLength(2);
    expect(
      messages.parsedMessages?.map((event) => {
        return {
          topic: event.topic,
          receiveTime: event.receiveTime,
          message: JSON.parse(JSON.stringify(event.message)),
        };
      }),
    ).toEqual([
      {
        topic: "/tf",
        receiveTime: {
          sec: 1396293888,
          nsec: 56251251,
        },
        message: {
          transforms: [
            {
              child_frame_id: "turtle2",
              header: { frame_id: "world", seq: 0, stamp: { nsec: 56065082, sec: 1396293888 } },
              transform: {
                rotation: { w: 1, x: 0, y: 0, z: 0 },
                translation: { x: 4, y: 9.088889122009277, z: 0 },
              },
            },
          ],
        },
      },
      {
        message: {
          transforms: [
            {
              child_frame_id: "turtle1",
              header: { frame_id: "world", seq: 0, stamp: { nsec: 56102037, sec: 1396293888 } },
              transform: {
                rotation: { w: 1, x: 0, y: 0, z: 0 },
                translation: { x: 5.544444561004639, y: 5.544444561004639, z: 0 },
              },
            },
          ],
        },
        receiveTime: { nsec: 56262848, sec: 1396293888 },
        topic: "/tf",
      },
    ]);
  });

  it("does not return parsed messages for binary-only requests", async () => {
    const provider = getProvider();
    await provider.initialize(dummyExtensionPoint);
    const start = { sec: 1396293887, nsec: 844783943 };
    const end = { sec: 1396293888, nsec: 60000000 };
    const messages = await provider.getMessages(start, end, {
      rosBinaryMessages: ["/tf"],
      parsedMessages: [],
    });
    expect(messages.rosBinaryMessages).toBe(undefined);
    expect(messages.parsedMessages).toEqual([]);
  });
});
