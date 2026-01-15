// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { useEffect, useRef } from "react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { useAppConfigurationValue, useAppTimeFormat } from "@lichtblick/suite-base/hooks";
import { format } from "@lichtblick/suite-base/util/formatTime";
import { formatTimeRaw, isAbsoluteTime } from "@lichtblick/suite-base/util/time";

const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;

export function EndTimestamp(): React.JSX.Element | ReactNull {
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
    <div style={{ fontFeatureSettings: `${theme.typography.fontFamily}, "zero"` }} ref={timeRef} />
  );
}
