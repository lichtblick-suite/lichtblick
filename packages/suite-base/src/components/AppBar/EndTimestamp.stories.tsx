// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Meta, StoryFn, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Time } from "@lichtblick/rostime";
import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import MockMessagePipelineProvider from "@lichtblick/suite-base/components/MessagePipeline/MockMessagePipelineProvider";
import AppConfigurationContext from "@lichtblick/suite-base/context/AppConfigurationContext";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";

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
    (Story: StoryFn, ctx): React.JSX.Element => {
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
