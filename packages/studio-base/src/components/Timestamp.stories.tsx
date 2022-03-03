// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack } from "@mui/material";
import { PropsWithChildren, useState } from "react";

import { Time } from "@foxglove/rostime";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Timestamp from "@foxglove/studio-base/components/Timestamp";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

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

function TimestampStory(props: PropsWithChildren<Props>): JSX.Element {
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

export function Default(): JSX.Element {
  return <TimestampStory config={[[AppSetting.TIMEZONE, "UTC"]]} time={ABSOLUTE_TIME} />;
}

export function TimeFormatSeconds(): JSX.Element {
  return (
    <TimestampStory
      config={[
        [AppSetting.TIME_FORMAT, "SEC"],
        [AppSetting.TIMEZONE, "UTC"],
      ]}
      time={ABSOLUTE_TIME}
    />
  );
}

export function TimeFormatTOD(): JSX.Element {
  return (
    <TimestampStory
      config={[
        [AppSetting.TIME_FORMAT, "TOD"],
        [AppSetting.TIMEZONE, "UTC"],
      ]}
      time={ABSOLUTE_TIME}
    />
  );
}

export function TimeFormatRelative(): JSX.Element {
  return (
    <TimestampStory
      config={[
        [AppSetting.TIME_FORMAT, "TOD"],
        [AppSetting.TIMEZONE, "UTC"],
      ]}
      time={RELATIVE_TIME}
    />
  );
}
