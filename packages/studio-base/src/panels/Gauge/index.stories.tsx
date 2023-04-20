// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryFn, StoryContext, StoryObj } from "@storybook/react";

import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import GaugePanel from "./index";

export default {
  title: "panels/Gauge",
  component: GaugePanel,
  decorators: [
    (StoryComponent: StoryFn, { parameters }: StoryContext): JSX.Element => {
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

export const EmptyState: StoryObj = {
  render: () => {
    return <GaugePanel />;
  },
};

export const InvalidValue: StoryObj = {
  render: function Story() {
    return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
  },

  parameters: { panelSetup: { fixture: makeFixture(NaN) } },
};

export const Rainbow: StoryObj = {
  render: function Story() {
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
  },

  parameters: { panelSetup: { fixture: makeFixture(0.3) } },
};

export const Turbo: StoryObj = {
  render: function Story() {
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
  },

  parameters: { panelSetup: { fixture: makeFixture(0.3) } },
};

export const TurboReverse: StoryObj = {
  render: function Story() {
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
  },

  parameters: { panelSetup: { fixture: makeFixture(0.3) } },
};

export const CustomGradient: StoryObj = {
  render: function Story() {
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
  },

  parameters: { panelSetup: { fixture: makeFixture(0.3) } },
};

export const CustomGradientReverse: StoryObj = {
  render: function Story() {
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
  },

  parameters: { panelSetup: { fixture: makeFixture(0.3) } },
};

export const MinValue: StoryObj = {
  render: function Story() {
    return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
  },

  parameters: { panelSetup: { fixture: makeFixture(0) } },
};

export const MaxValue: StoryObj = {
  render: function Story() {
    return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
  },

  parameters: { panelSetup: { fixture: makeFixture(1) } },
};

export const TooLow: StoryObj = {
  render: function Story() {
    return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
  },

  parameters: { panelSetup: { fixture: makeFixture(-1) } },
};

export const TooHigh: StoryObj = {
  render: function Story() {
    return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 0, maxValue: 1 }} />;
  },

  parameters: { panelSetup: { fixture: makeFixture(2) } },
};

export const CustomRange: StoryObj = {
  render: function Story() {
    return <GaugePanel overrideConfig={{ path: "/data.value", minValue: 5, maxValue: 7 }} />;
  },

  parameters: { panelSetup: { fixture: makeFixture(6.5) } },
};

export const MessagePathWithFilter: StoryObj = {
  render: function Story() {
    return (
      <GaugePanel overrideConfig={{ path: `/data{id=="b"}.value`, minValue: 0, maxValue: 4 }} />
    );
  },

  parameters: {
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
  },
};

export const StringValue: StoryObj = {
  render: function Story() {
    return <GaugePanel overrideConfig={{ path: `/data.value`, minValue: 0, maxValue: 1 }} />;
  },

  parameters: {
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
  },
};
