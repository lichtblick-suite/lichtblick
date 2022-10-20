// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";

import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import GaugePanel from "./index";

export default {
  title: "panels/Gauge",
  component: GaugePanel,
  decorators: [
    (StoryComponent: Story, { parameters }: StoryContext): JSX.Element => {
      return (
        <PanelSetup fixture={parameters.panelSetup?.fixture}>
          <StoryComponent />
        </PanelSetup>
      );
    },
  ],
};

function makeFixture(value: number) {
  return {
    topics: [{ name: "/data", datatype: "foo_msgs/Bar" }],
    datatypes: new Map([
      ["foo_msgs/Bar", { name: "Bar", definitions: [{ name: "value", type: "float32" }] }],
    ]),
    frame: {
      "/data": [
        {
          topic: "/data",
          receiveTime: { sec: 123, nsec: 456 },
          message: { value },
        },
      ],
    },
  };
}

export const EmptyState = (): JSX.Element => {
  return <GaugePanel />;
};

export const InvalidValue = (): JSX.Element => {
  return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
};
InvalidValue.parameters = { panelSetup: { fixture: makeFixture(NaN) } };

export const Rainbow = (): JSX.Element => {
  return (
    <GaugePanel
      overrideConfig={{
        path: "/data.value",
        minValue: 0,
        maxValue: 1,
        colorMode: "colormap",
        colorMap: "rainbow",
      }}
    />
  );
};
Rainbow.parameters = { panelSetup: { fixture: makeFixture(0.3) } };

export const Turbo = (): JSX.Element => {
  return (
    <GaugePanel
      overrideConfig={{
        path: "/data.value",
        minValue: 0,
        maxValue: 1,
        colorMode: "colormap",
        colorMap: "turbo",
      }}
    />
  );
};
Turbo.parameters = { panelSetup: { fixture: makeFixture(0.3) } };

export const TurboReverse = (): JSX.Element => {
  return (
    <GaugePanel
      overrideConfig={{
        path: "/data.value",
        minValue: 0,
        maxValue: 1,
        colorMode: "colormap",
        colorMap: "turbo",
        reverse: true,
      }}
    />
  );
};
TurboReverse.parameters = { panelSetup: { fixture: makeFixture(0.3) } };

export const CustomGradient = (): JSX.Element => {
  return (
    <GaugePanel
      overrideConfig={{
        path: "/data.value",
        minValue: 0,
        maxValue: 1,
        colorMode: "gradient",
        gradient: ["#ec9a57", "#65c6ff"],
      }}
    />
  );
};
CustomGradient.parameters = { panelSetup: { fixture: makeFixture(0.3) } };

export const CustomGradientReverse = (): JSX.Element => {
  return (
    <GaugePanel
      overrideConfig={{
        path: "/data.value",
        minValue: 0,
        maxValue: 1,
        colorMode: "gradient",
        gradient: ["#ec9a57", "#65c6ff"],
        reverse: true,
      }}
    />
  );
};
CustomGradientReverse.parameters = { panelSetup: { fixture: makeFixture(0.3) } };

export const MinValue = (): JSX.Element => {
  return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
};
MinValue.parameters = { panelSetup: { fixture: makeFixture(0) } };

export const MaxValue = (): JSX.Element => {
  return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
};
MaxValue.parameters = { panelSetup: { fixture: makeFixture(1) } };

export const TooLow = (): JSX.Element => {
  return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
};
TooLow.parameters = { panelSetup: { fixture: makeFixture(-1) } };
export const TooHigh = (): JSX.Element => {
  return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
};
TooHigh.parameters = { panelSetup: { fixture: makeFixture(2) } };

export const CustomRange = (): JSX.Element => {
  return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 5, maxValue: 7 }} />;
};
CustomRange.parameters = { panelSetup: { fixture: makeFixture(6.5) } };

export const MessagePathWithFilter = (): JSX.Element => {
  return <GaugePanel overrideConfig={{ path: `/data{id=="b"}.value`, minValue: 0, maxValue: 4 }} />;
};
MessagePathWithFilter.parameters = {
  panelSetup: {
    fixture: {
      topics: [{ name: "/data", datatype: "foo_msgs/Bar" }],
      frame: {
        "/data": [
          {
            topic: "/data",
            receiveTime: { sec: 123, nsec: 456 },
            message: { id: "a", value: 1 },
          },
          {
            topic: "/data",
            receiveTime: { sec: 123, nsec: 456 },
            message: { id: "b", value: 2 },
          },
          {
            topic: "/data",
            receiveTime: { sec: 123, nsec: 456 },
            message: { id: "c", value: 3 },
          },
        ],
      },
    },
  },
};

export const StringValue = (): JSX.Element => {
  return <GaugePanel overrideConfig={{ path: `/data.value`, minValue: 0, maxValue: 1 }} />;
};
StringValue.parameters = {
  panelSetup: {
    fixture: {
      topics: [{ name: "/data", datatype: "foo_msgs/Bar" }],
      frame: {
        "/data": [
          {
            topic: "/data",
            receiveTime: { sec: 123, nsec: 456 },
            message: { value: "0.2" },
          },
        ],
      },
    },
  },
};
