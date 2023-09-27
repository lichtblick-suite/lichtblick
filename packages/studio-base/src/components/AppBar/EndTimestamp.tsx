// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { useEffect, useRef } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { useAppConfigurationValue, useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { format } from "@foxglove/studio-base/util/formatTime";
import { formatTimeRaw, isAbsoluteTime } from "@foxglove/studio-base/util/time";

const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;

export function EndTimestamp(): JSX.Element | ReactNull {
  const endTime = useMessagePipeline(selectEndTime);
  const [timezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);
  const { timeFormat } = useAppTimeFormat();
  const theme = useTheme();

  const timeRef = useRef<HTMLDivElement>(ReactNull);

  // We bypass react and update the DOM elements directly for better performance here.
  useEffect(() => {
    if (!timeRef.current) {
      return;
    }
    if (endTime == undefined) {
      timeRef.current.innerText = "";
      return;
    }
    const timeOfDayString = format(endTime, timezone);
    const timeRawString = formatTimeRaw(endTime);

    timeRef.current.innerText =
      timeFormat === "SEC" || !isAbsoluteTime(endTime) ? timeRawString : timeOfDayString;
  }, [endTime, timeFormat, timezone]);

  return (
    <div
      style={{ fontFeatureSettings: `${theme.typography.fontFeatureSettings}, "zero"` }}
      ref={timeRef}
    />
  );
}
