// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Meta, StoryFn, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Time } from "@foxglove/rostime";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

import { EndTimestamp } from "./EndTimestamp";

type StoryArgs = {
  time?: Time;
  timezone?: string;
  timeFormat?: "SEC" | "TOD";
};

const ABSOLUTE_TIME = { sec: 1643800942, nsec: 222222222 };
const RELATIVE_TIME = { sec: 630720000, nsec: 597648236 };

export default {
  title: "components/AppBar/EndTimestamp",
  component: EndTimestamp,
  args: {
    timezone: "UTC",
    time: ABSOLUTE_TIME,
  },
  decorators: [
    (Story: StoryFn, ctx): JSX.Element => {
      const {
        args: { timeFormat, timezone, time, ...args },
      } = ctx;
      const [value] = useState(() =>
        makeMockAppConfiguration([
          [AppSetting.TIMEZONE, timezone],
          [AppSetting.TIME_FORMAT, timeFormat],
        ]),
      );

      return (
        <AppConfigurationContext.Provider value={value}>
          <MockMessagePipelineProvider endTime={time} presence={PlayerPresence.PRESENT}>
            <div style={{ padding: 16 }}>
              <Story {...args} />
            </div>
          </MockMessagePipelineProvider>
        </AppConfigurationContext.Provider>
      );
    },
  ],
} satisfies Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const TimeFormatSeconds: Story = {
  args: { timeFormat: "SEC" },
};

export const TimeFormatTOD: StoryObj = {
  args: { timeFormat: "TOD" },
};

export const TimeFormatRelative: StoryObj = {
  args: { time: RELATIVE_TIME },
};
