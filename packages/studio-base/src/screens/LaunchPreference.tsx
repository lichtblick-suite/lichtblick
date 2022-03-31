// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";

import { AppSetting } from "../AppSetting";
import { useAppConfigurationValue } from "../hooks";
import { useSessionStorageValue } from "../hooks/useSessionStorageValue";
import { LaunchPreferenceScreen } from "./LaunchPreferenceScreen";
import { LaunchingInDesktopScreen } from "./LaunchingInDesktopScreen";

export function LaunchPreference(props: PropsWithChildren<unknown>): JSX.Element {
  const [globalLaunchPreference = "unknown"] = useAppConfigurationValue<string>(
    AppSetting.LAUNCH_PREFERENCE,
  );
  const [sessionLaunchPreference] = useSessionStorageValue(AppSetting.LAUNCH_PREFERENCE);

  // Session preferences take priority over global preferences.
  const activePreference = sessionLaunchPreference ?? globalLaunchPreference;

  const url = new URL(window.location.href);
  const hasParams = Array.from(url.searchParams.entries()).length > 0;
  // Ask the user in which environment they want to open this session.
  if (activePreference === "unknown" && hasParams) {
    return <LaunchPreferenceScreen />;
  } else if (activePreference === "desktop" && hasParams) {
    return <LaunchingInDesktopScreen />;
  } else {
    return <>{props.children}</>;
  }
}
