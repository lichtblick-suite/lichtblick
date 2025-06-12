// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { fromSec, toSec } from "@lichtblick/rostime";
import { BlockCache, MessageBlock, MessageEvent } from "@lichtblick/suite-base/players/types";
import { Fixture } from "@lichtblick/suite-base/stories/PanelSetup";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";

const locationMessages = [
  {
    header: { stamp: { sec: 0, nsec: 574635076 } },
    pose: { acceleration: -0.00116662939, velocity: 1.184182664 },
  },
  {
    header: { stamp: { sec: 0, nsec: 673758203 } },
    pose: { acceleration: -0.0072101709, velocity: 1.182555127 },
  },
  {
    header: { stamp: { sec: 0, nsec: 770527187 } },
    pose: { acceleration: 0.0079536558, velocity: 1.185625054 },
  },
  {
    header: { stamp: { sec: 0, nsec: 871076484 } },
    pose: { acceleration: 0.037758707, velocity: 1.193871954 },
  },
  {
    header: { stamp: { sec: 0, nsec: 995802312 } },
    pose: { acceleration: 0.085267948, velocity: 1.210280466 },
  },
  {
    header: { stamp: { sec: 1, nsec: 81700551 } },
    pose: { acceleration: 0.34490595, velocity: 1.28371423 },
  },
  {
    header: { stamp: { sec: 1, nsec: 184463111 } },
    pose: { acceleration: 0.59131456, velocity: 1.379807198 },
  },
  {
    header: { stamp: { sec: 1, nsec: 285808851 } },
    pose: { acceleration: 0.78738064, velocity: 1.487955727 },
  },
  {
    header: { stamp: { sec: 1, nsec: 371183619 } },
    pose: { acceleration: 0.91150866, velocity: 1.581979428 },
  },
  {
    header: { stamp: { sec: 1, nsec: 479369260 } },
    pose: { acceleration: 1.03091162, velocity: 1.70297429 },
  },
  {
    header: { stamp: { sec: 1, nsec: 587095370 } },
    pose: { acceleration: 1.15341371, velocity: 1.857311045 },
  },
  {
    header: { stamp: { sec: 1, nsec: 685730694 } },
    pose: { acceleration: 1.06827219, velocity: 1.951372604 },
  },
  {
    header: { stamp: { sec: 1, nsec: 785737230 } },
    pose: { acceleration: 0.76826461, velocity: 1.98319952 },
  },
  {
    header: { stamp: { sec: 1, nsec: 869057829 } },
    pose: { acceleration: 0.52827271, velocity: 1.984654942 },
  },
  {
    header: { stamp: { sec: 1, nsec: 984145879 } },
    pose: { acceleration: 0.16827019, velocity: 1.958059206 },
  },
  {
    header: { stamp: { sec: 2, nsec: 85765716 } },
    pose: { acceleration: -0.13173667, velocity: 1.899877099 },
  },
  {
    header: { stamp: { sec: 2, nsec: 182717960 } },
    pose: { acceleration: -0.196482967, velocity: 1.87051731 },
  },
  {
    header: { stamp: { sec: 2, nsec: 286998440 } },
    pose: { acceleration: -0.204713665, velocity: 1.848811251 },
  },
  {
    header: { stamp: { sec: 2, nsec: 370689856 } },
    pose: { acceleration: -0.18596813, velocity: 1.837120153 },
  },
  {
    header: { stamp: { sec: 2, nsec: 483672422 } },
    pose: { acceleration: -0.13091373, velocity: 1.828568433 },
  },
  {
    header: { stamp: { sec: 2, nsec: 578787057 } },
    pose: { acceleration: -0.119039923, velocity: 1.82106361 },
  },
  {
    header: { stamp: { sec: 2, nsec: 677515597 } },
    pose: { acceleration: -0.419040352, velocity: 1.734159507 },
  },
  {
    header: { stamp: { sec: 2, nsec: 789110904 } },
    pose: { acceleration: -0.48790808, velocity: 1.666657974 },
  },
];

const otherStateMessages = [
  { header: { stamp: { sec: 0, nsec: 574635076 } }, items: [{ id: 42, speed: 0.1 }] },
  { header: { stamp: { sec: 0, nsec: 871076484 } }, items: [{ id: 42, speed: 0.2 }] },
  { header: { stamp: { sec: 1, nsec: 81700551 } }, items: [{ id: 42, speed: 0.3 }] },
  {
    header: { stamp: { sec: 1, nsec: 479369260 } },
    items: [
      { id: 10, speed: 1.4 },
      { id: 42, speed: 0.2 },
    ],
  },
  {
    header: { stamp: { sec: 1, nsec: 785737230 } },
    items: [
      { id: 10, speed: 1.5 },
      { id: 42, speed: 0.1 },
    ],
  },
  {
    header: { stamp: { sec: 2, nsec: 182717960 } },
    items: [
      { id: 10, speed: 1.57 },
      { id: 42, speed: 0.08 },
    ],
  },
  {
    header: { stamp: { sec: 2, nsec: 578787057 } },
    items: [
      { id: 10, speed: 1.63 },
      { id: 42, speed: 0.06 },
    ],
  },
] as const;

const datatypes: RosDatatypes = new Map(
  Object.entries({
    "msgs/PoseDebug": {
      definitions: [
        { name: "header", type: "std_msgs/Header", isArray: false, isComplex: true },
        { name: "pose", type: "msgs/Pose", isArray: false, isComplex: true },
      ],
    },
    "msgs/Pose": {
      definitions: [
        { name: "header", type: "std_msgs/Header", isArray: false, isComplex: true },
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
        { name: "header", type: "std_msgs/Header", isArray: false, isComplex: true },
        { name: "items", type: "msgs/OtherState", isArray: true, isComplex: true },
      ],
    },
    "msgs/OtherState": {
      definitions: [
        { name: "id", type: "int32", isArray: false },
        { name: "speed", type: "float32", isArray: false },
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
    "std_msgs/Bool": { definitions: [{ name: "data", type: "bool", isArray: false }] },
    "nonstd_msgs/Float64Stamped": {
      definitions: [
        { name: "header", type: "std_msgs/Header", isArray: false, isComplex: true },
        { name: "data", type: "float64", isArray: false },
      ],
    },
  }),
);

const getPreloadedMessage = (seconds: number): MessageEvent => ({
  topic: "/preloaded_topic",
  receiveTime: fromSec(seconds),
  message: {
    data: Math.pow(seconds, 2),
    header: { stamp: fromSec(seconds - 0.5), frame_id: "", seq: 0 },
  },
  schemaName: "foo",
  sizeInBytes: 0,
});

const emptyBlock: MessageBlock = {
  messagesByTopic: {
    "/preloaded_topic": [],
  },
  sizeInBytes: 0,
  needTopics: new Map(),
};

const messageCache: BlockCache = {
  blocks: [
    ...[0.6, 0.7, 0.8, 0.9, 1.0].map((seconds) => ({
      sizeInBytes: 0,
      messagesByTopic: { "/preloaded_topic": [getPreloadedMessage(seconds)] },
      needTopics: new Map(),
    })),
    emptyBlock, // 1.1
    emptyBlock, // 1.2
    emptyBlock, // 1.3
    emptyBlock, // 1.4
    ...[1.5, 1.6, 1.7, 1.8, 1.9].map((seconds) => ({
      sizeInBytes: 0,
      messagesByTopic: { "/preloaded_topic": [getPreloadedMessage(seconds)] },
      needTopics: new Map(),
    })),
  ],
  startTime: fromSec(0.6),
};

export const fixture: Fixture = {
  datatypes,
  topics: [
    { name: "/some_topic/location", schemaName: "msgs/PoseDebug" },
    { name: "/some_topic/location_subset", schemaName: "msgs/PoseDebug" },
    { name: "/some_topic/location_shuffled", schemaName: "msgs/PoseDebug" },
    { name: "/some_topic/state", schemaName: "msgs/State" },
    { name: "/boolean_topic", schemaName: "std_msgs/Bool" },
    { name: "/preloaded_topic", schemaName: "nonstd_msgs/Float64Stamped" },
  ],
  activeData: {
    startTime: { sec: 0, nsec: 202050 },
    endTime: { sec: 24, nsec: 999997069 },
    // In a real player, currentTime should be >= all the message receiveTimes in the latest frame
    currentTime: _.maxBy([...locationMessages, ...otherStateMessages], (msg) =>
      toSec(msg.header.stamp),
    )?.header.stamp,
    isPlaying: false,
    speed: 0.2,
  },
  frame: {
    "/some_topic/location": locationMessages.map(
      (message): MessageEvent => ({
        topic: "/some_topic/location",
        receiveTime: message.header.stamp,
        message,
        schemaName: "msgs/PoseDebug",
        sizeInBytes: 0,
      }),
    ),
    "/some_topic/location_subset": locationMessages
      .slice(locationMessages.length / 3, (locationMessages.length * 2) / 3)
      .map(
        (message): MessageEvent => ({
          topic: "/some_topic/location_subset",
          receiveTime: message.header.stamp,
          message,
          schemaName: "msgs/PoseDebug",
          sizeInBytes: 0,
        }),
      ),
    "/some_topic/state": otherStateMessages.map(
      (message): MessageEvent => ({
        topic: "/some_topic/state",
        receiveTime: message.header.stamp,
        message,
        schemaName: "msgs/State",
        sizeInBytes: 0,
      }),
    ),
    "/boolean_topic": [
      {
        topic: "/boolean_topic",
        receiveTime: { sec: 1, nsec: 0 },
        message: { data: true },
        schemaName: "std_msgs/Bool",
        sizeInBytes: 0,
      },
    ],
    // Shuffle the location messages so that they are out of stamp order
    // This is used in the headerStamp series test to check that the dataset is sorted
    // prior to rendering. If the dataset is not sorted properly, the plot is jumbled.
    "/some_topic/location_shuffled": _.shuffle(
      locationMessages.map(
        (message): MessageEvent => ({
          topic: "/some_topic/location_shuffled",
          receiveTime: message.header.stamp,
          message,
          schemaName: "msgs/PoseDebug",
          sizeInBytes: 0,
        }),
      ),
    ),
  },
  progress: { messageCache },
};
