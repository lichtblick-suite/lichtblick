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

import { MessageEvent } from "@foxglove/studio-base/players/types";
import { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
// ts-prune-ignore-next
export const datatypes: RosDatatypes = new Map(
  Object.entries({
    "some/datatype": { definitions: [{ name: "index", type: "int32" }] },
  }),
);

// ts-prune-ignore-next
export const messages = Object.freeze<MessageEvent<unknown>>([
  {
    topic: "/some/topic",
    receiveTime: { sec: 100, nsec: 0 },
    message: { index: 0 },
    schemaName: "msgs/PoseDebug",
    sizeInBytes: 0,
  },
  {
    topic: "/some/topic",
    receiveTime: { sec: 101, nsec: 0 },
    message: { index: 1 },
    schemaName: "msgs/PoseDebug",
    sizeInBytes: 0,
  },
  {
    topic: "/some/topic",
    receiveTime: { sec: 102, nsec: 0 },
    message: { index: 2 },
    schemaName: "msgs/PoseDebug",
    sizeInBytes: 0,
  },
]);

// ts-prune-ignore-next
export const MessagePathInputStoryFixture: Fixture = {
  datatypes: new Map(
    Object.entries({
      "msgs/PoseDebug": {
        definitions: [
          { name: "header", type: "std_msgs/Header", isArray: false },
          { name: "pose", type: "msgs/Pose", isArray: false },
        ],
      },
      "msgs/Pose": {
        definitions: [
          { name: "header", type: "std_msgs/Header", isArray: false },
          { name: "x", type: "float64", isArray: false },
          { name: "y", type: "float64", isArray: false },
          { name: "travel", type: "float64", isArray: false },
          { name: "velocity", type: "float64", isArray: false },
          { name: "acceleration", type: "float64", isArray: false },
          { name: "heading", type: "float64", isArray: false },
        ],
      },
      "msgs/State": {
        definitions: [
          { name: "header", type: "std_msgs/Header", isArray: false },
          { name: "items", type: "msgs/OtherState", isArray: true },
          { name: "foo_id", type: "uint32", isArray: false },
        ],
      },
      "msgs/OtherState": {
        definitions: [
          { name: "id", type: "int32", isArray: false },
          { name: "speed", type: "float32", isArray: false },
          { name: "name", type: "string", isArray: false },
          { name: "valid", type: "bool", isArray: false },
        ],
      },
      "msgs/Log": {
        definitions: [
          { name: "id", type: "int32", isArray: false },
          { name: "myJson", type: "json", isArray: false },
          { name: "severity", type: "float32", isArray: false },
        ],
      },
      "std_msgs/Header": {
        definitions: [
          { name: "seq", type: "uint32", isArray: false },
          {
            name: "stamp",
            type: "time",
            isArray: false,
          },
          { name: "frame_id", type: "string", isArray: false },
        ],
      },
    }),
  ),
  topics: [
    { name: "/some_topic/location", schemaName: "msgs/PoseDebug" },
    { name: "/some_topic/state", schemaName: "msgs/State" },
    {
      name: "/very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_long_topic_name/state",
      schemaName: "msgs/State",
    },
    { name: "/some_logs_topic", schemaName: "msgs/Log" },
  ],
  frame: {},
  globalVariables: { global_var_1: 42, global_var_2: 10 },
};
