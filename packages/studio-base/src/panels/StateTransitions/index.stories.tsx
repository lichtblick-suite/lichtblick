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

import { useCallback } from "react";
import TestUtils from "react-dom/test-utils";

import { BlockCache } from "@foxglove/studio-base/randomAccessDataProviders/MemoryCacheDataProvider";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";

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

const fixture = {
  datatypes: new Map(
    Object.entries({
      "msgs/SystemState": {
        definitions: [
          { type: "std_msgs/Header", name: "header", isArray: false },
          { type: "int8", name: "UNKNOWN", isConstant: true, value: -1 },
          { type: "int8", name: "OFF", isConstant: true, value: 1 },
          { type: "int8", name: "BOOTING", isConstant: true, value: 2 },
          { type: "int8", name: "ACTIVE", isConstant: true, value: 3 },
          { type: "int8", name: "state", isArray: false },
          { type: "json", name: "data", isArray: false },
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
    { name: "/some/topic/with/state", datatype: "msgs/SystemState" },
    { name: "/blocks", datatype: "msgs/SystemState" },
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
    })),
  },
};

export default {
  title: "panels/StateTransitions/index",
  component: StateTransitions,
  parameters: {
    chromatic: {
      delay: 100,
    },
  },
};

OnePath.parameters = { useReadySignal: true };
export function OnePath(): JSX.Element {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return (
    <PanelSetup fixture={fixture} pauseFrame={pauseFrame}>
      <StateTransitions
        overrideConfig={{
          paths: [{ value: "/some/topic/with/state.state", timestampMethod: "receiveTime" }],
        }}
      />
    </PanelSetup>
  );
}

MultiplePaths.parameters = { useReadySignal: true };
export function MultiplePaths(): JSX.Element {
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
        }}
      />
    </PanelSetup>
  );
}

MultiplePathsWithHover.parameters = { useReadySignal: true };
export function MultiplePathsWithHover(): JSX.Element {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return (
    <PanelSetup
      fixture={fixture}
      pauseFrame={pauseFrame}
      onMount={() => {
        const mouseEnterContainer = document.querySelectorAll(
          "[data-test~=panel-mouseenter-container",
        )[0]!;
        TestUtils.Simulate.mouseEnter(mouseEnterContainer);
      }}
      style={{ width: 370 }}
    >
      <StateTransitions
        overrideConfig={{
          paths: new Array(5).fill({
            value: "/some/topic/with/state.state",
            timestampMethod: "receiveTime",
          }),
        }}
      />
    </PanelSetup>
  );
}

LongPath.parameters = { useReadySignal: true };
export function LongPath(): JSX.Element {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return (
    <PanelSetup fixture={fixture} pauseFrame={pauseFrame} style={{ maxWidth: 100 }}>
      <StateTransitions
        overrideConfig={{
          paths: [{ value: "/some/topic/with/state.state", timestampMethod: "receiveTime" }],
        }}
      />
    </PanelSetup>
  );
}

JsonPath.parameters = { useReadySignal: true };
export function JsonPath(): JSX.Element {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return (
    <PanelSetup fixture={fixture} pauseFrame={pauseFrame}>
      <StateTransitions
        overrideConfig={{
          paths: [{ value: "/some/topic/with/state.data.value", timestampMethod: "receiveTime" }],
        }}
      />
    </PanelSetup>
  );
}

const messageCache: BlockCache = {
  blocks: [
    {
      sizeInBytes: 0,
      messagesByTopic: {
        "/blocks": systemStateMessages.slice(0, 5).map((message, idx) => ({
          topic: "/blocks",
          receiveTime: message.header.stamp,
          message: { ...message, data: { value: idx } },
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
        })),
      },
    },
  ],
  startTime: systemStateMessages[0]!.header.stamp,
};

Blocks.parameters = { useReadySignal: true };
export function Blocks(): JSX.Element {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  const blockFixture = { ...fixture, progress: { messageCache } };

  return (
    <PanelSetup fixture={blockFixture} pauseFrame={pauseFrame}>
      <StateTransitions
        overrideConfig={{
          paths: [
            { value: "/some/topic/with/state.state", timestampMethod: "receiveTime" },
            { value: "/blocks.state", timestampMethod: "receiveTime" },
          ],
        }}
      />
    </PanelSetup>
  );
}
