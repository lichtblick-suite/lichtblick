// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack } from "@mui/material";
import { StoryObj } from "@storybook/react";
import { PropsWithChildren, useState } from "react";

import { Time } from "@lichtblick/rostime";
import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import Timestamp from "@lichtblick/suite-base/components/Timestamp";
import AppConfigurationContext from "@lichtblick/suite-base/context/AppConfigurationContext";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";

const ABSOLUTE_TIME = { sec: 1643800942, nsec: 222222222 };
const RELATIVE_TIME = { sec: 630720000, nsec: 597648236 };

export default {
  component: Timestamp,
  title: "components/Timestamp",
};

type Props = {
  config?: [AppSetting, string | undefined][];
  time: Time;
};

function TimestampStory(props: PropsWithChildren<Props>): React.JSX.Element {
  const { config, time } = props;
  const [value] = useState(() => makeMockAppConfiguration(config));

  return (
    <AppConfigurationContext.Provider value={value}>
      <Stack padding={2} spacing={2}>
        <Timestamp horizontal time={time} />
        <Timestamp time={time} />
        <Timestamp disableDate time={time} />
      </Stack>
    </AppConfigurationContext.Provider>
  );
}

export const Default: StoryObj = {
  render: () => {
    return <TimestampStory config={[[AppSetting.TIMEZONE, "UTC"]]} time={ABSOLUTE_TIME} />;
  },
};

export const TimeFormatSeconds: StoryObj = {
  render: () => {
    return (
      <TimestampStory
        config={[
          [AppSetting.TIME_FORMAT, "SEC"],
          [AppSetting.TIMEZONE, "UTC"],
        ]}
        time={ABSOLUTE_TIME}
      />
    );
  },
};

export const TimeFormatTOD: StoryObj = {
  render: () => {
    return (
      <TimestampStory
        config={[
          [AppSetting.TIME_FORMAT, "TOD"],
          [AppSetting.TIMEZONE, "UTC"],
        ]}
        time={ABSOLUTE_TIME}
      />
    );
  },
};

export const TimeFormatRelative: StoryObj = {
  render: () => {
    return (
      <TimestampStory
        config={[
          [AppSetting.TIME_FORMAT, "TOD"],
          [AppSetting.TIMEZONE, "UTC"],
        ]}
        time={RELATIVE_TIME}
      />
    );
  },
};
