// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack } from "@fluentui/react";
import { ComponentProps, useState } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import { makeConfiguration } from "@foxglove/studio-base/util/makeConfiguration";

import Duration from "./Duration";

export default {
  component: Duration,
  title: "components/Duration",
};

type Props = ComponentProps<typeof Duration>;

function DurationStory(props: Props): JSX.Element {
  const [secAppConfig] = useState(() =>
    makeConfiguration([
      [AppSetting.TIME_FORMAT, "SEC"],
      [AppSetting.TIMEZONE, "UTC"],
    ]),
  );
  const [todAppConfig] = useState(() =>
    makeConfiguration([
      [AppSetting.TIME_FORMAT, "TOD"],
      [AppSetting.TIMEZONE, "UTC"],
    ]),
  );

  return (
    <Stack tokens={{ padding: 16, childrenGap: 16 }}>
      <AppConfigurationContext.Provider value={secAppConfig}>
        <Duration {...props} />
      </AppConfigurationContext.Provider>
      <AppConfigurationContext.Provider value={todAppConfig}>
        <Duration {...props} />
      </AppConfigurationContext.Provider>
    </Stack>
  );
}

export function Zero(): JSX.Element {
  return <DurationStory duration={{ sec: 0, nsec: 0 }} />;
}

export function Hour(): JSX.Element {
  return <DurationStory duration={{ sec: 3600, nsec: 123456789 }} />;
}

export function HourMinuteSeconds(): JSX.Element {
  return <DurationStory duration={{ sec: 23485, nsec: 123456789 }} />;
}
