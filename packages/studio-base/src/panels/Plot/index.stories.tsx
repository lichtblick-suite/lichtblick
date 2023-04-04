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

import { Story } from "@storybook/react";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { shuffle } from "lodash";
import { useCallback, useRef } from "react";
import { makeStyles } from "tss-react/mui";

import { fromSec } from "@foxglove/rostime";
import Plot, { PlotConfig } from "@foxglove/studio-base/panels/Plot";
import { BlockCache, MessageEvent } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture, triggerWheel } from "@foxglove/studio-base/stories/PanelSetup";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

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
];

const withEndTime = (testFixture: Fixture, endTime: any) => ({
  ...testFixture,
  activeData: { ...testFixture.activeData, endTime },
});

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

const getPreloadedMessage = (seconds: number) => ({
  topic: "/preloaded_topic",
  receiveTime: fromSec(seconds),
  message: {
    data: Math.pow(seconds, 2),
    header: { stamp: fromSec(seconds - 0.5), frame_id: "", seq: 0 },
  },
});

const emptyBlock = {
  messagesByTopic: {},
  sizeInBytes: 0,
};

const messageCache: BlockCache = {
  blocks: [
    ...[0.6, 0.7, 0.8, 0.9, 1.0].map((seconds) => ({
      sizeInBytes: 0,
      messagesByTopic: { "/preloaded_topic": [getPreloadedMessage(seconds)] },
    })),
    emptyBlock, // 1.1
    emptyBlock, // 1.2
    emptyBlock, // 1.3
    emptyBlock, // 1.4
    ...[1.5, 1.6, 1.7, 1.8, 1.9].map((seconds) => ({
      sizeInBytes: 0,
      messagesByTopic: { "/preloaded_topic": [getPreloadedMessage(seconds)] },
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
    currentTime: { sec: 0, nsec: 750000000 },
    isPlaying: false,
    speed: 0.2,
  },
  frame: {
    "/some_topic/location": locationMessages.map(
      (message): MessageEvent<unknown> => ({
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
        (message): MessageEvent<unknown> => ({
          topic: "/some_topic/location_subset",
          receiveTime: message.header.stamp,
          message,
          schemaName: "msgs/PoseDebug",
          sizeInBytes: 0,
        }),
      ),
    "/some_topic/state": otherStateMessages.map(
      (message): MessageEvent<unknown> => ({
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
    "/some_topic/location_shuffled": shuffle(
      locationMessages.map(
        (message): MessageEvent<unknown> => ({
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

export const paths: PlotConfig["paths"] = [
  { value: "/some_topic/location.pose.velocity", enabled: true, timestampMethod: "receiveTime" },
  {
    value: "/some_topic/location.pose.acceleration",
    enabled: true,
    timestampMethod: "receiveTime",
  },
  {
    value: "/some_topic/location.pose.acceleration.@derivative",
    enabled: true,
    timestampMethod: "receiveTime",
  },
  { value: "/boolean_topic.data", enabled: true, timestampMethod: "receiveTime" },
  { value: "/some_topic/state.items[0].speed", enabled: true, timestampMethod: "receiveTime" },
  { value: "/some_topic/location.header.stamp", enabled: true, timestampMethod: "receiveTime" },
];

const exampleConfig: PlotConfig = {
  paths,
  xAxisVal: "timestamp",
  showLegend: true,
  isSynced: true,
  legendDisplay: "floating",
  showXAxisLabels: true,
  showYAxisLabels: true,
  showPlotValuesInLegend: false,
  sidebarDimension: 0,
};

function PlotWrapper(props: {
  style?: { [key: string]: string | number };
  includeSettings?: boolean;
  fixture?: Fixture;
  pauseFrame: (_arg: string) => () => void;
  config: PlotConfig;
}): JSX.Element {
  return (
    <PanelSetup
      fixture={props.fixture ?? fixture}
      pauseFrame={props.pauseFrame}
      includeSettings={props.includeSettings}
      style={{ ...props.style }}
    >
      <Plot overrideConfig={props.config} />
    </PanelSetup>
  );
}

export default {
  title: "panels/Plot",
  component: Plot,
  parameters: {
    chromatic: { delay: 50 },
  },
  excludeStories: ["paths", "fixture"],
};

export const LineGraph: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return <PlotWrapper pauseFrame={pauseFrame} config={exampleConfig} />;
};
LineGraph.play = async (ctx) => {
  await ctx.parameters.storyReady;
};
LineGraph.storyName = "line graph";
LineGraph.parameters = {
  useReadySignal: true,
};

export const LineGraphWithXMinMax: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{ ...exampleConfig, minXValue: 1, maxXValue: 2 }}
    />
  );
};
LineGraphWithXMinMax.play = async (ctx) => {
  await ctx.parameters.storyReady;
};
LineGraphWithXMinMax.storyName = "line graph with x min & max";
LineGraphWithXMinMax.parameters = {
  colorScheme: "light",
  useReadySignal: true,
};

export const LineGraphWithXRange: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{ ...exampleConfig, followingViewWidth: 3 }}
      includeSettings
    />
  );
};
LineGraphWithXRange.play = async (ctx) => {
  await ctx.parameters.storyReady;
};
LineGraphWithXRange.parameters = {
  colorScheme: "light",
  useReadySignal: true,
};
LineGraphWithXRange.storyName = "line graph with x range";

export const LineGraphWithNoTitle: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return <PlotWrapper pauseFrame={pauseFrame} config={{ ...exampleConfig, title: undefined }} />;
};
LineGraphWithNoTitle.play = async (ctx) => {
  await ctx.parameters.storyReady;
};
LineGraphWithNoTitle.storyName = "line graph with no title";
LineGraphWithNoTitle.parameters = {
  useReadySignal: true,
};

export const LineGraphWithSettings: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{ ...exampleConfig, minYValue: -1, maxYValue: 1, minXValue: 0, maxXValue: 3 }}
      includeSettings
    />
  );
};
LineGraphWithSettings.parameters = {
  colorScheme: "light",
  useReadySignal: true,
};
LineGraphWithSettings.storyName = "line graph with settings";
LineGraphWithSettings.play = async (ctx) => {
  const user = userEvent.setup();
  const label = await screen.findByTestId("settings__nodeHeaderToggle__yAxis");
  await user.click(label);
  await ctx.parameters.storyReady;
};

export const LineGraphWithSettingsChinese = Object.assign(LineGraphWithSettings.bind(undefined), {
  play: LineGraphWithSettings.play,
  parameters: {
    ...LineGraphWithSettings.parameters,
    forceLanguage: "zh",
  },
});

export const LineGraphWithLegendsHidden: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  return <PlotWrapper pauseFrame={pauseFrame} config={{ ...exampleConfig, showLegend: false }} />;
};
LineGraphWithLegendsHidden.play = async (ctx) => {
  await ctx.parameters.storyReady;
};
LineGraphWithLegendsHidden.storyName = "line graph with legends hidden";
LineGraphWithLegendsHidden.parameters = {
  useReadySignal: true,
};

const useStyles = makeStyles()(() => ({
  PanelSetup: {
    flexDirection: "column",
    "& > *": {
      // minHeight necessary to get around otherwise flaky test because of layout
      minHeight: "50%",
    },
  },
}));

export const InALineGraphWithMultiplePlotsXAxesAreSynced: Story = () => {
  const readySignal = useReadySignal({ count: 6 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  const { classes } = useStyles();

  return (
    <PanelSetup fixture={fixture} pauseFrame={pauseFrame} className={classes.PanelSetup}>
      <Plot
        overrideConfig={{
          ...exampleConfig,
          paths: [
            {
              value: "/some_topic/location.pose.acceleration",
              enabled: true,
              timestampMethod: "receiveTime",
            },
          ],
        }}
      />
      <Plot
        overrideConfig={{
          ...exampleConfig,
          paths: [
            {
              value: "/some_topic/location_subset.pose.velocity",
              enabled: true,
              timestampMethod: "receiveTime",
            },
          ],
        }}
      />
    </PanelSetup>
  );
};
InALineGraphWithMultiplePlotsXAxesAreSynced.storyName =
  "in a line graph with multiple plots, x-axes are synced";
InALineGraphWithMultiplePlotsXAxesAreSynced.parameters = {
  useReadySignal: true,
};
InALineGraphWithMultiplePlotsXAxesAreSynced.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const LineGraphAfterZoom: Story = () => {
  const pauseState = useRef<"init" | "zoom" | "ready">("init");
  const readyState = useReadySignal();

  const doZoom = useCallback(() => {
    const canvasEl = document.querySelector("canvas");
    // Zoom is a continuous event, so we need to simulate wheel multiple times
    if (canvasEl) {
      for (let i = 0; i < 5; i++) {
        triggerWheel(canvasEl.parentElement!, 1);
      }
    }

    // indicate our next render completion should mark the scene ready
    pauseState.current = "ready";
  }, []);

  const pauseFrame = useCallback(() => {
    return () => {
      switch (pauseState.current) {
        case "init":
          pauseState.current = "zoom";
          break;
        case "zoom":
          doZoom();
          break;
        default:
          readyState();
          break;
      }
    };
  }, [doZoom, readyState]);

  return <PlotWrapper pauseFrame={pauseFrame} config={exampleConfig} />;
};
LineGraphAfterZoom.storyName = "line graph after zoom";
LineGraphAfterZoom.parameters = {
  useReadySignal: true,
  colorScheme: "dark",
};
LineGraphAfterZoom.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const TimestampMethodHeaderStamp: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location_shuffled.pose.velocity",
            enabled: true,
            timestampMethod: "headerStamp",
          },
          { value: "/boolean_topic.data", enabled: true, timestampMethod: "headerStamp" },
        ],
      }}
    />
  );
};
TimestampMethodHeaderStamp.storyName = "timestampMethod: headerStamp";
TimestampMethodHeaderStamp.parameters = {
  useReadySignal: true,
};
TimestampMethodHeaderStamp.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const LongPath: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      style={{ maxWidth: 250 }}
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
      }}
    />
  );
};
LongPath.storyName = "long path";
LongPath.parameters = {
  useReadySignal: true,
};
LongPath.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const DisabledPath: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: false,
            timestampMethod: "receiveTime",
          },
          {
            value: "/some_topic/location.pose.acceleration",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
      }}
    />
  );
};
DisabledPath.storyName = "disabled path";
DisabledPath.parameters = {
  useReadySignal: true,
};
DisabledPath.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const ReferenceLine: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          { value: "0", enabled: true, timestampMethod: "receiveTime" }, // Test typing a period for decimal values. value: "1.", enabled: true, timestampMethod: "receiveTime",
          { value: "1.", enabled: true, timestampMethod: "receiveTime" },
          { value: "1.5", enabled: true, timestampMethod: "receiveTime" },
          { value: "1", enabled: false, timestampMethod: "receiveTime" },
        ],
        minYValue: "-1",
        maxYValue: "2",
      }}
    />
  );
};
ReferenceLine.storyName = "reference line";
ReferenceLine.parameters = {
  useReadySignal: true,
};
ReferenceLine.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const WithMinAndMaxYValues: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      includeSettings
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        minYValue: "1",
        maxYValue: "2.8",
      }}
    />
  );
};
WithMinAndMaxYValues.parameters = {
  colorScheme: "light",
  useReadySignal: true,
};
WithMinAndMaxYValues.storyName = "with min and max Y values";
WithMinAndMaxYValues.play = async () => {
  const user = userEvent.setup();
  const label = await screen.findByText("Y Axis");
  await user.click(label);
};

export const WithJustMinYValueLessThanMinimumValue: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        minYValue: "1",
      }}
    />
  );
};
WithJustMinYValueLessThanMinimumValue.storyName = "with just min Y value less than minimum value";
WithJustMinYValueLessThanMinimumValue.parameters = {
  useReadySignal: true,
};
WithJustMinYValueLessThanMinimumValue.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const WithJustMinYValueMoreThanMinimumValue: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        minYValue: "1.4",
      }}
    />
  );
};
WithJustMinYValueMoreThanMinimumValue.storyName = "with just min Y value more than minimum value";
WithJustMinYValueMoreThanMinimumValue.parameters = {
  useReadySignal: true,
};
WithJustMinYValueMoreThanMinimumValue.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const WithJustMinYValueMoreThanMaximumValue: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        minYValue: "5",
      }}
    />
  );
};
WithJustMinYValueMoreThanMaximumValue.storyName = "with just min Y value more than maximum value";
WithJustMinYValueMoreThanMaximumValue.parameters = {
  useReadySignal: true,
};
WithJustMinYValueMoreThanMaximumValue.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const WithJustMaxYValueLessThanMaximumValue: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        maxYValue: "1.8",
      }}
    />
  );
};
WithJustMaxYValueLessThanMaximumValue.storyName = "with just max Y value less than maximum value";
WithJustMaxYValueLessThanMaximumValue.parameters = {
  useReadySignal: true,
};
WithJustMaxYValueLessThanMaximumValue.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const WithJustMaxYValueMoreThanMaximumValue: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        maxYValue: "2.8",
      }}
    />
  );
};
WithJustMaxYValueMoreThanMaximumValue.storyName = "with just max Y value more than maximum value";
WithJustMaxYValueMoreThanMaximumValue.parameters = {
  useReadySignal: true,
};
WithJustMaxYValueMoreThanMaximumValue.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const WithJustMaxYValueLessThanMinimumValue: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        maxYValue: "1",
      }}
    />
  );
};
WithJustMaxYValueLessThanMinimumValue.storyName = "with just max Y value less than minimum value";
WithJustMaxYValueLessThanMinimumValue.parameters = {
  useReadySignal: true,
};
WithJustMaxYValueLessThanMinimumValue.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const ScatterPlotPlusLineGraphPlusReferenceLine: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/state.items[:].speed",
            enabled: true,
            timestampMethod: "receiveTime",
          },
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
          { value: "3", enabled: true, timestampMethod: "receiveTime" },
        ],
      }}
    />
  );
};
ScatterPlotPlusLineGraphPlusReferenceLine.storyName =
  "scatter plot plus line graph plus reference line";
ScatterPlotPlusLineGraphPlusReferenceLine.parameters = {
  useReadySignal: true,
};
ScatterPlotPlusLineGraphPlusReferenceLine.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const IndexBasedXAxisForArray: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        xAxisVal: "index",
        paths: [
          {
            value: "/some_topic/state.items[:].speed",
            enabled: true,
            timestampMethod: "receiveTime",
          }, // Should show up only in the legend: For now index plots always use playback data, and ignore preloaded data.
          { value: "/preloaded_topic.data", enabled: true, timestampMethod: "receiveTime" },
        ],
      }}
    />
  );
};
IndexBasedXAxisForArray.storyName = "index-based x-axis for array";
IndexBasedXAxisForArray.parameters = {
  useReadySignal: true,
};
IndexBasedXAxisForArray.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const CustomXAxisTopic: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        xAxisVal: "custom",
        paths: [
          {
            value: "/some_topic/location.pose.acceleration",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        xAxisPath: { value: "/some_topic/location.pose.velocity", enabled: true },
      }}
    />
  );
};
CustomXAxisTopic.storyName = "custom x-axis topic";
CustomXAxisTopic.parameters = {
  useReadySignal: true,
};
CustomXAxisTopic.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const CustomXAxisTopicWithXLimits: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        xAxisVal: "custom",
        minXValue: 1.3,
        maxXValue: 1.8,
        paths: [
          {
            value: "/some_topic/location.pose.acceleration",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        xAxisPath: { value: "/some_topic/location.pose.velocity", enabled: true },
      }}
    />
  );
};
CustomXAxisTopicWithXLimits.parameters = {
  colorScheme: "light",
  useReadySignal: true,
};
CustomXAxisTopicWithXLimits.storyName = "custom x-axis topic with x limits";
CustomXAxisTopicWithXLimits.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const CurrentCustomXAxisTopic: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  // As above, but just shows a single point instead of the whole line.
  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        xAxisVal: "currentCustom",
        paths: [
          {
            value: "/some_topic/location.pose.acceleration",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        xAxisPath: { value: "/some_topic/location.pose.velocity", enabled: true },
      }}
    />
  );
};
CurrentCustomXAxisTopic.storyName = "current custom x-axis topic";
CurrentCustomXAxisTopic.parameters = {
  useReadySignal: true,
};
CurrentCustomXAxisTopic.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const CustomXAxisTopicWithMismatchedDataLengths: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        xAxisVal: "custom",
        paths: [
          // Extra items in y-axis
          {
            value: "/some_topic/location.pose.acceleration",
            enabled: true,
            timestampMethod: "receiveTime",
          }, // Same number of items
          {
            value: "/some_topic/location_subset.pose.acceleration",
            enabled: true,
            timestampMethod: "receiveTime",
          }, // Fewer items in y-axis
          {
            value: "/some_topic/state.items[:].speed",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        xAxisPath: { value: "/some_topic/location_subset.pose.velocity", enabled: true },
      }}
    />
  );
};
CustomXAxisTopicWithMismatchedDataLengths.storyName =
  "custom x-axis topic with mismatched data lengths";
CustomXAxisTopicWithMismatchedDataLengths.parameters = {
  useReadySignal: true,
};
CustomXAxisTopicWithMismatchedDataLengths.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const SuperCloseValues: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      fixture={{
        datatypes: new Map(
          Object.entries({
            "std_msgs/Float32": {
              definitions: [{ name: "data", type: "float32", isArray: false }],
            },
          }),
        ),
        topics: [{ name: "/some_number", schemaName: "std_msgs/Float32" }],
        activeData: {
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 10, nsec: 0 },
          isPlaying: false,
          speed: 0.2,
        },
        frame: {
          "/some_number": [
            {
              topic: "/some_number",
              receiveTime: { sec: 0, nsec: 0 },
              message: { data: 1.8548483304974972 },
              schemaName: "std_msgs/Float32",
              sizeInBytes: 0,
            },
            {
              topic: "/some_number",
              receiveTime: { sec: 1, nsec: 0 },
              message: { data: 1.8548483304974974 },
              schemaName: "std_msgs/Float32",
              sizeInBytes: 0,
            },
          ],
        },
      }}
      config={{
        ...exampleConfig,
        paths: [{ value: "/some_number.data", enabled: true, timestampMethod: "receiveTime" }],
      }}
    />
  );
};
SuperCloseValues.storyName = "super close values";
SuperCloseValues.parameters = {
  useReadySignal: true,
};
SuperCloseValues.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const TimeValues: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      config={{
        ...exampleConfig,
        xAxisVal: "custom",
        paths: [
          {
            value: "/some_topic/location.pose.velocity",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
        xAxisPath: { value: "/some_topic/location.header.stamp", enabled: true },
      }}
    />
  );
};
TimeValues.storyName = "time values";
TimeValues.parameters = {
  useReadySignal: true,
};
TimeValues.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const PreloadedDataInBinaryBlocks: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      fixture={withEndTime(fixture, { sec: 2, nsec: 0 })}
      config={{
        ...exampleConfig,
        paths: [
          { value: "/preloaded_topic.data", enabled: true, timestampMethod: "receiveTime" },
          { value: "/preloaded_topic.data", enabled: true, timestampMethod: "headerStamp" },
        ],
      }}
    />
  );
};
PreloadedDataInBinaryBlocks.storyName = "preloaded data in binary blocks";
PreloadedDataInBinaryBlocks.parameters = {
  useReadySignal: true,
};
PreloadedDataInBinaryBlocks.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const MixedStreamedAndPreloadedData: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      fixture={withEndTime(fixture, { sec: 3, nsec: 0 })}
      config={{
        ...exampleConfig,
        paths: [
          {
            value: "/some_topic/state.items[0].speed",
            enabled: true,
            timestampMethod: "receiveTime",
          },
          { value: "/preloaded_topic.data", enabled: true, timestampMethod: "receiveTime" },
        ],
      }}
    />
  );
};
MixedStreamedAndPreloadedData.storyName = "mixed streamed and preloaded data";
MixedStreamedAndPreloadedData.parameters = {
  useReadySignal: true,
};
MixedStreamedAndPreloadedData.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const PreloadedDataAndItsDerivative: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      fixture={withEndTime(fixture, { sec: 2, nsec: 0 })}
      config={{
        ...exampleConfig,
        paths: [
          { value: "/preloaded_topic.data", enabled: true, timestampMethod: "receiveTime" },
          {
            value: "/preloaded_topic.data.@derivative",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
      }}
    />
  );
};
PreloadedDataAndItsDerivative.storyName = "preloaded data and its derivative";
PreloadedDataAndItsDerivative.parameters = {
  useReadySignal: true,
};
PreloadedDataAndItsDerivative.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const PreloadedDataAndItsNegative: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      fixture={withEndTime(fixture, { sec: 2, nsec: 0 })}
      config={{
        ...exampleConfig,
        paths: [
          { value: "/preloaded_topic.data", enabled: true, timestampMethod: "receiveTime" },
          {
            value: "/preloaded_topic.data.@negative",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
      }}
    />
  );
};
PreloadedDataAndItsNegative.storyName = "preloaded data and its negative";
PreloadedDataAndItsNegative.parameters = {
  useReadySignal: true,
};
PreloadedDataAndItsNegative.play = async (ctx) => {
  await ctx.parameters.storyReady;
};

export const PreloadedDataAndItsAbsoluteValue: Story = () => {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PlotWrapper
      pauseFrame={pauseFrame}
      fixture={withEndTime(fixture, { sec: 2, nsec: 0 })}
      config={{
        ...exampleConfig,
        paths: [
          { value: "/preloaded_topic.data", enabled: true, timestampMethod: "receiveTime" },
          {
            value: "/preloaded_topic.data.@abs",
            enabled: true,
            timestampMethod: "receiveTime",
          },
        ],
      }}
    />
  );
};
PreloadedDataAndItsAbsoluteValue.storyName = "preloaded data and its absolute value";
PreloadedDataAndItsAbsoluteValue.parameters = {
  useReadySignal: true,
};
PreloadedDataAndItsAbsoluteValue.play = async (ctx) => {
  await ctx.parameters.storyReady;
};
