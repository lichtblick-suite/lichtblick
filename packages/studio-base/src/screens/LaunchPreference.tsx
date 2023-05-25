// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";

import { useSessionStorageValue } from "@foxglove/hooks";
import { LaunchPreferenceValue } from "@foxglove/studio-base/types/LaunchPreferenceValue";

import { LaunchPreferenceScreen } from "./LaunchPreferenceScreen";
import { LaunchingInDesktopScreen } from "./LaunchingInDesktopScreen";
import { AppSetting } from "../AppSetting";
import { useAppConfigurationValue } from "../hooks";

export function LaunchPreference(props: PropsWithChildren<unknown>): JSX.Element {
  const [globalLaunchPreference] = useAppConfigurationValue<string>(AppSetting.LAUNCH_PREFERENCE);
  const [sessionLaunchPreference] = useSessionStorageValue(AppSetting.LAUNCH_PREFERENCE);

  const url = new URL(window.location.href);

  // Session preferences take priority over URL and global preferences. This allows the button in
  // LaunchPreferenceScreen to override the url when clicked.
  let activePreference =
    sessionLaunchPreference ?? url.searchParams.get("openIn") ?? globalLaunchPreference;
  switch (activePreference) {
    case LaunchPreferenceValue.WEB:
    case LaunchPreferenceValue.DESKTOP:
    case LaunchPreferenceValue.ASK:
      break;
    default:
      activePreference = LaunchPreferenceValue.WEB;
  }

  const hasParams = Array.from(url.searchParams.entries()).length > 0;
  // Ask the user in which environment they want to open this session.
  if (activePreference === LaunchPreferenceValue.ASK && hasParams) {
    return <LaunchPreferenceScreen />;
  } else if (activePreference === LaunchPreferenceValue.DESKTOP && hasParams) {
    return <LaunchingInDesktopScreen />;
  } else {
    return <>{props.children}</>;
  }
}
