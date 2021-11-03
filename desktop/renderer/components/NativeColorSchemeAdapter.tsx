// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useLayoutEffect } from "react";

import { AppSetting, useAppConfigurationValue } from "@foxglove/studio-base";

import { Desktop } from "../../common/types";

const desktopBridge = (global as { desktopBridge?: Desktop }).desktopBridge;

/** Notify the main process when the user has changed their color scheme setting. */
export default function NativeColorSchemeAdapter(): ReactNull {
  const [colorScheme] = useAppConfigurationValue<string>(AppSetting.COLOR_SCHEME);
  useLayoutEffect(() => {
    void colorScheme;
    desktopBridge?.updateNativeColorScheme();
  }, [colorScheme]);
  return ReactNull;
}
