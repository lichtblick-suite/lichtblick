// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import moment from "moment-timezone";
import { useCallback, useMemo } from "react";

import { Time } from "@foxglove/studio";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { TimeDisplayMethod } from "@foxglove/studio-base/types/panels";
import { formatDate, formatTime } from "@foxglove/studio-base/util/formatTime";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { useAppConfigurationValue } from "./useAppConfigurationValue";

export interface IAppTimeFormat {
  formatDate: (date: Time) => string;
  formatTime: (stamp: Time) => string;
  formatDuration: (duration: Time) => string;
  timeFormat: TimeDisplayMethod;
  setTimeFormat: (format: TimeDisplayMethod) => Promise<void>;
  timeZone: string | undefined;
}

export function useAppTimeFormat(): IAppTimeFormat {
  const [timeFormat, setTimeFormat] = useAppConfigurationValue<string>(AppSetting.TIME_FORMAT);
  const [timeZone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);

  const effectiveFormat: TimeDisplayMethod = useMemo(
    () => (timeFormat === "SEC" ? "SEC" : "TOD"),
    [timeFormat],
  );

  const formatDateCallback = useCallback(
    (date: Time) => {
      return formatDate(date, timeZone);
    },
    [timeZone],
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

  const formatDurationCallback = useCallback(
    (duration: Time) => {
      if (effectiveFormat === "TOD") {
        return (
          moment.duration(duration.sec * 1e3).format("h:mm:ss", { trim: false }) +
          `.${duration.nsec}`
        );
      } else {
        return formatTimeRaw(duration);
      }
    },
    [effectiveFormat],
  );

  return {
    formatDate: formatDateCallback,
    formatTime: formatTimeCallback,
    formatDuration: formatDurationCallback,
    setTimeFormat,
    timeFormat: effectiveFormat,
    timeZone,
  };
}
