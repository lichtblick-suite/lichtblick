// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import { useMemo } from "react";

import { Time } from "@foxglove/rostime";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { formatDate } from "@foxglove/studio-base/util/formatTime";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { isAbsoluteTime, formatTimeRaw } from "@foxglove/studio-base/util/time";

type Props = {
  disableDate?: boolean;
  horizontal?: boolean;
  time: Time;
  timezone?: string;
};

export default function Timestamp(props: Props): JSX.Element {
  const { disableDate = false, horizontal = false, time, timezone } = props;
  const { formatTime } = useAppTimeFormat();
  const currentTimeStr = useMemo(() => formatTime(time), [time, formatTime]);
  const rawTimeStr = useMemo(() => formatTimeRaw(time), [time]);
  const date = useMemo(() => formatDate(time, timezone), [time, timezone]);

  if (!isAbsoluteTime(time)) {
    return (
      <Stack direction="row" alignItems="center" flexGrow={0}>
        <Typography fontFamily={fonts.MONOSPACE} variant="inherit">
          {rawTimeStr}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack gap={0.5}>
      <Stack
        gap={1}
        flexWrap="wrap"
        direction={horizontal ? "row" : "column"}
        alignItems={horizontal ? "center" : "flex-start"}
        justifyContent={horizontal ? "flex-start" : "center"}
      >
        {!disableDate && (
          <Typography
            noWrap
            fontWeight={!horizontal ? 700 : undefined}
            fontFamily={fonts.MONOSPACE}
            variant="inherit"
          >
            {date}
          </Typography>
        )}

        <Stack direction="row" alignItems="center" flexShrink={0} gap={0.5}>
          <Typography variant="inherit" fontFamily={fonts.MONOSPACE}>
            {currentTimeStr}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}
