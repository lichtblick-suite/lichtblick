// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";

import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import Indicator from "./index";

export default {
  title: "panels/IndicatorLight",
  component: Indicator,
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

function makeFixture(value: boolean | number | bigint | string) {
  return {
    topics: [{ name: "/data", datatype: "foo_msgs/Bar" }],
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
  return <Indicator />;
};

export const MissingValue = (): JSX.Element => {
  return (
    <Indicator
      overrideConfig={{
        path: "/data.value",
        style: "bulb",
        rules: [
          { operator: "=", rawValue: "true", color: "#00dd00", label: "True" },
          { operator: "=", rawValue: "true", color: "#dd00dd", label: "False" },
        ],
        fallbackColor: "#dddd00",
        fallbackLabel: "Fallback",
      }}
    />
  );
};

export const BackgroundStyle = (): JSX.Element => {
  return (
    <Indicator
      overrideConfig={{
        path: "/data.value",
        style: "background",
        rules: [
          { operator: "=", rawValue: "true", color: "#00dd00", label: "True" },
          { operator: "=", rawValue: "true", color: "#dd00dd", label: "False" },
        ],
        fallbackColor: "#dddd00",
        fallbackLabel: "Fallback",
      }}
    />
  );
};

const BooleanStory = (): JSX.Element => {
  return (
    <Indicator
      overrideConfig={{
        path: "/data.value",
        style: "bulb",
        rules: [
          { operator: "=", rawValue: "true", color: "#00dd00", label: "True" },
          { operator: "=", rawValue: "false", color: "#dd00dd", label: "False" },
        ],
        fallbackColor: "#dddd00",
        fallbackLabel: "Fallback",
      }}
    />
  );
};
export const BooleanTrue = (): JSX.Element => <BooleanStory />;
BooleanTrue.parameters = { panelSetup: { fixture: makeFixture(true) } };
export const BooleanFalse = (): JSX.Element => <BooleanStory />;
BooleanFalse.parameters = { panelSetup: { fixture: makeFixture(false) } };

export const String = (): JSX.Element => {
  return (
    <Indicator
      overrideConfig={{
        path: "/data.value",
        style: "bulb",
        rules: [{ operator: "=", rawValue: "hello", color: "#00dd00", label: "Hello" }],
        fallbackColor: "#dddd00",
        fallbackLabel: "Fallback",
      }}
    />
  );
};
String.parameters = { panelSetup: { fixture: makeFixture("hello") } };

const NumberStory = (): JSX.Element => {
  return (
    <Indicator
      overrideConfig={{
        path: "/data.value",
        style: "bulb",
        rules: [
          { operator: "<", rawValue: "0", color: "#00dd00", label: "Negative" },
          { operator: "=", rawValue: "0", color: "#929292", label: "Zero" },
          { operator: ">", rawValue: "0", color: "#dd00dd", label: "Positive" },
        ],
        fallbackColor: "#dddd00",
        fallbackLabel: "Fallback",
      }}
    />
  );
};
export const NumberNegative = (): JSX.Element => <NumberStory />;
NumberNegative.parameters = { panelSetup: { fixture: makeFixture(-1) } };
export const NumberZero = (): JSX.Element => <NumberStory />;
NumberZero.parameters = { panelSetup: { fixture: makeFixture(0) } };
export const NumberPositive = (): JSX.Element => <NumberStory />;
NumberPositive.parameters = { panelSetup: { fixture: makeFixture(1) } };

export const MessagePathWithFilter = (): JSX.Element => {
  return (
    <Indicator
      overrideConfig={{
        path: `/data{id=="b"}.value`,
        style: "bulb",
        rules: [
          { operator: "=", rawValue: "true", color: "#00dd00", label: "True" },
          { operator: "=", rawValue: "false", color: "#dd00dd", label: "False" },
        ],
        fallbackColor: "#dddd00",
        fallbackLabel: "Fallback",
      }}
    />
  );
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
            message: { id: "a", value: false },
          },
          {
            topic: "/data",
            receiveTime: { sec: 123, nsec: 456 },
            message: { id: "b", value: true },
          },
          {
            topic: "/data",
            receiveTime: { sec: 123, nsec: 456 },
            message: { id: "c", value: false },
          },
        ],
      },
    },
  },
};
