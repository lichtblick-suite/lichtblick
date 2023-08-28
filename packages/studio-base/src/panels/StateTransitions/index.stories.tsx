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

import { StoryObj } from "@storybook/react";
import { produce } from "immer";
import { useCallback } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import { BlockCache } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";
import { expandedLineColors } from "@foxglove/studio-base/util/plotColors";

import StateTransitions from "./index";

const systemStateMessages = [
  { header: { stamp: { sec: 1526191539, nsec: 574635076 } }, state: 0 },
  { header: { stamp: { sec: 1526191539, nsec: 673758203 } }, state: 0 },
  { header: { stamp: { sec: 1526191539, nsec: 770527187 } }, state: 1 },
  { header: { stamp: { sec: 1526191539, nsec: 871076484 } }, state: 1 },
  { header: { stamp: { sec: 1526191539, nsec: 995802312 } }, state: 1 },
  { header: { stamp: { sec: 1526191540, nsec: 81700551 } }, state: 1 },
  { header: { stamp: { sec: 1526191540, nsec: 184463111 } }, state: 1 },
  { header: { stamp: { sec: 1526191540, nsec: 285808851 } }, state: 2 },
  { header: { stamp: { sec: 1526191540, nsec: 371183619 } }, state: 2 },
  { header: { stamp: { sec: 1526191540, nsec: 479369260 } }, state: 2 },
  { header: { stamp: { sec: 1526191540, nsec: 587095370 } }, state: 2 },
  { header: { stamp: { sec: 1526191540, nsec: 685730694 } }, state: 2 },
  { header: { stamp: { sec: 1526191540, nsec: 785737230 } }, state: 2 },
  { header: { stamp: { sec: 1526191540, nsec: 869057829 } }, state: 2 },
  { header: { stamp: { sec: 1526191540, nsec: 984145879 } }, state: 2 },
  { header: { stamp: { sec: 1526191541, nsec: 85765716 } }, state: 2 },
  { header: { stamp: { sec: 1526191541, nsec: 182717960 } }, state: 3 },
  { header: { stamp: { sec: 1526191541, nsec: 286998440 } }, state: 3 },
  { header: { stamp: { sec: 1526191541, nsec: 370689856 } }, state: 3 },
  { header: { stamp: { sec: 1526191541, nsec: 483672422 } }, state: -1 },
  { header: { stamp: { sec: 1526191541, nsec: 578787057 } }, state: -1 },
  { header: { stamp: { sec: 1526191541, nsec: 677515597 } }, state: -1 },
  { header: { stamp: { sec: 1526191541, nsec: 789110904 } }, state: -1 },
];

const fixture: Fixture = {
  datatypes: new Map(
    Object.entries({
      "msgs/SystemState": {
        definitions: [
          { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
          { type: "int8", name: "UNKNOWN", isConstant: true, value: -1 },
          { type: "int8", name: "OFF", isConstant: true, value: 1 },
          { type: "int8", name: "BOOTING", isConstant: true, value: 2 },
          { type: "int8", name: "ACTIVE", isConstant: true, value: 3 },
          { type: "int8", name: "state", isArray: false },
          { type: "msgs/DataValue", name: "data", isArray: false, isComplex: true },
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
      "msgs/DataValue": {
        definitions: [{ type: "string", name: "value", isArray: false, isComplex: false }],
      },
    }),
  ),
  topics: [
    { name: "/some/topic/with/state", schemaName: "msgs/SystemState" },
    { name: "/some/topic/with/string_state", schemaName: "msgs/SystemState" },
    { name: "/blocks", schemaName: "msgs/SystemState" },
  ],
  activeData: {
    startTime: { sec: 1526191527, nsec: 202050 },
    endTime: { sec: 1526191551, nsec: 999997069 },
    isPlaying: false,
    speed: 0.2,
  },
  frame: {
    "/some/topic/with/state": systemStateMessages.map((message, idx) => ({
      topic: "/some/topic/with/state",
      receiveTime: message.header.stamp,
      message: { ...message, data: { value: idx } },
      schemaName: "msgs/SystemState",

      sizeInBytes: 0,
    })),
    "/some/topic/with/string_state": systemStateMessages.map((message, idx) => {
      const values = "abcdefghijklmnopqrstuvwxyz".split("");
      return {
        topic: "/some/topic/with/string_state",
        receiveTime: message.header.stamp,
        message: { ...message, data: { value: values[idx % values.length] } },
        schemaName: "msgs/SystemState",
        sizeInBytes: 0,
      };
    }),
  },
};

export default {
  title: "panels/StateTransitions",
  component: StateTransitions,
  parameters: {
    chromatic: { delay: 100 },
  },
};

export const ColorPalette: StoryObj = {
  render: () => (
    <Stack padding={2} fullWidth>
      {expandedLineColors.map((color) => (
        <div key={color} style={{ backgroundColor: color, height: "1rem" }} />
      ))}
    </Stack>
  ),
};

export const CloseValues: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 3 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    const closeMessages = [
      { header: { stamp: { sec: 0, nsec: 0 } }, state: 0 },
      { header: { stamp: { sec: 0, nsec: 0 } }, state: 1 },
      { header: { stamp: { sec: 0, nsec: 0 } }, state: 2 },
      { header: { stamp: { sec: 0, nsec: 0 } }, state: 3 },
      { header: { stamp: { sec: 0, nsec: 0 } }, state: 4 },
      { header: { stamp: { sec: 100, nsec: 0 } }, state: 4 },
    ];

    const closeFixture = produce(fixture, (draft) => {
      draft.activeData = {
        startTime: { sec: 0, nsec: 0 },
        endTime: { sec: 100, nsec: 0 },
        isPlaying: false,
        speed: 0.2,
      };
      draft.frame = {
        "/some/topic/with/state": closeMessages.map((message) => ({
          topic: "/some/topic/with/state",
          receiveTime: message.header.stamp,
          message,
          schemaName: "msgs/SystemState",
          sizeInBytes: 0,
        })),
      };
    });

    return (
      <PanelSetup fixture={closeFixture} pauseFrame={pauseFrame}>
        <StateTransitions
          overrideConfig={{
            paths: [{ value: "/some/topic/with/state.state", timestampMethod: "receiveTime" }],
            isSynced: true,
          }}
        />
      </PanelSetup>
    );
  },
  play: async ({ parameters }) => {
    await parameters.storyReady;
  },
  parameters: {
    colorScheme: "light",
    useReadySignal: true,
  },
};

export const OnePath: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 3 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    return (
      <PanelSetup fixture={fixture} pauseFrame={pauseFrame}>
        <StateTransitions
          overrideConfig={{
            paths: [{ value: "/some/topic/with/state.state", timestampMethod: "receiveTime" }],
            isSynced: true,
          }}
        />
      </PanelSetup>
    );
  },
  play: async ({ parameters }) => {
    await parameters.storyReady;
  },
  parameters: { useReadySignal: true },
};

export const WithXAxisMinMax: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 3 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    return (
      <PanelSetup fixture={fixture} pauseFrame={pauseFrame} includeSettings>
        <StateTransitions
          overrideConfig={{
            xAxisMinValue: 11,
            xAxisMaxValue: 15,
            paths: [{ value: "/some/topic/with/state.state", timestampMethod: "receiveTime" }],
            isSynced: true,
          }}
        />
      </PanelSetup>
    );
  },
  play: async ({ parameters }) => {
    await parameters.storyReady;
  },
  parameters: { colorScheme: "light", useReadySignal: true },
};

export const WithXAxisRange: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 3 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    const ourFixture = produce(fixture, (draft) => {
      draft.activeData!.currentTime = systemStateMessages.at(-1)?.header.stamp;
    });

    return (
      <PanelSetup fixture={ourFixture} pauseFrame={pauseFrame} includeSettings>
        <StateTransitions
          overrideConfig={{
            xAxisRange: 3,
            paths: [{ value: "/some/topic/with/state.state", timestampMethod: "receiveTime" }],
            isSynced: true,
          }}
        />
      </PanelSetup>
    );
  },
  play: async ({ parameters }) => {
    await parameters.storyReady;
  },
  parameters: { colorScheme: "light", useReadySignal: true },
};

export const WithSettings: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 3 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    return (
      <PanelSetup fixture={fixture} pauseFrame={pauseFrame} includeSettings>
        <StateTransitions
          overrideConfig={{
            paths: [{ value: "/some/topic/with/state.state", timestampMethod: "receiveTime" }],
            isSynced: true,
          }}
        />
      </PanelSetup>
    );
  },
  play: async ({ parameters }) => {
    await parameters.storyReady;
  },
  parameters: { useReadySignal: true },
};

export const MultiplePaths: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 3 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    return (
      <PanelSetup fixture={fixture} pauseFrame={pauseFrame}>
        <StateTransitions
          overrideConfig={{
            paths: new Array(5).fill({
              value: "/some/topic/with/state.state",
              timestampMethod: "receiveTime",
            }),
            isSynced: true,
          }}
        />
      </PanelSetup>
    );
  },
  play: async ({ parameters }) => {
    await parameters.storyReady;
  },
  parameters: { useReadySignal: true },
};

export const LongPath: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 3 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    return (
      <PanelSetup fixture={fixture} pauseFrame={pauseFrame} style={{ maxWidth: 100 }}>
        <StateTransitions
          overrideConfig={{
            paths: [{ value: "/some/topic/with/state.state", timestampMethod: "receiveTime" }],
            isSynced: true,
          }}
        />
      </PanelSetup>
    );
  },
  play: async ({ parameters }) => {
    await parameters.storyReady;
  },
  parameters: { useReadySignal: true },
};

export const ColorClash: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 3 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    return (
      <PanelSetup fixture={fixture} pauseFrame={pauseFrame}>
        <StateTransitions
          overrideConfig={{
            paths: [
              { value: "/some/topic/with/string_state.data.value", timestampMethod: "receiveTime" },
            ],
            isSynced: true,
          }}
        />
      </PanelSetup>
    );
  },
  play: async ({ parameters }) => {
    await parameters.storyReady;
  },
  parameters: { useReadySignal: true },
};

const messageCache: BlockCache = {
  blocks: [
    {
      sizeInBytes: 0,
      messagesByTopic: {
        "/blocks": systemStateMessages.slice(0, 5).map((message, idx) => ({
          topic: "/blocks",
          receiveTime: message.header.stamp,
          message: { ...message, data: { value: idx } },
          schemaName: "msgs/SystemState",

          sizeInBytes: 0,
        })),
      },
    },
    {
      sizeInBytes: 0,
      messagesByTopic: {
        "/blocks": systemStateMessages.slice(7, 12).map((message, idx) => ({
          topic: "/blocks",
          receiveTime: message.header.stamp,
          message: { ...message, data: { value: idx } },
          schemaName: "msgs/SystemState",

          sizeInBytes: 0,
        })),
      },
    },
    {
      sizeInBytes: 0,
      messagesByTopic: {},
    },
    {
      sizeInBytes: 0,
      messagesByTopic: {
        "/blocks": systemStateMessages.slice(15, 19).map((message, idx) => ({
          topic: "/blocks",
          receiveTime: message.header.stamp,
          message: { ...message, data: { value: idx } },
          schemaName: "msgs/SystemState",
          sizeInBytes: 0,
        })),
      },
    },
  ],
  startTime: systemStateMessages[0]!.header.stamp,
};

export const Blocks: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 3 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    return (
      <PanelSetup fixture={{ ...fixture, progress: { messageCache } }} pauseFrame={pauseFrame}>
        <StateTransitions
          overrideConfig={{
            paths: [
              { value: "/some/topic/with/state.state", timestampMethod: "receiveTime" },
              { value: "/blocks.state", timestampMethod: "receiveTime" },
              { value: "/blocks.state", timestampMethod: "receiveTime" },
            ],
            isSynced: true,
          }}
        />
      </PanelSetup>
    );
  },
  play: async ({ parameters }) => {
    await parameters.storyReady;
  },
  parameters: { useReadySignal: true },
};
