// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useMemo } from "react";

import { Time } from "@foxglove/studio";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { TimeDisplayMethod } from "@foxglove/studio-base/types/panels";
import { formatTime } from "@foxglove/studio-base/util/formatTime";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { useAppConfigurationValue } from "./useAppConfigurationValue";

export function useAppTimeFormat(): {
  formatTime: (stamp: Time) => string;
  timeFormat: TimeDisplayMethod;
  setTimeFormat: (format: TimeDisplayMethod) => Promise<void>;
  timeZone: string | undefined;
} {
  const [timeFormat, setTimeFormat] = useAppConfigurationValue<string>(AppSetting.TIME_FORMAT);
  const [timeZone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);

  const effectiveFormat: TimeDisplayMethod = useMemo(
    () => (timeFormat === "SEC" ? "SEC" : "TOD"),
    [timeFormat],
  );

  const formatTimeCallback = useCallback(
    (stamp: Time) => {
      if (effectiveFormat === "TOD") {
        return formatTime(stamp, timeZone);
      } else {
        return formatTimeRaw(stamp);
      }
    },
    [effectiveFormat, timeZone],
  );

  return {
    formatTime: formatTimeCallback,
    setTimeFormat,
    timeFormat: effectiveFormat,
    timeZone,
  };
}
