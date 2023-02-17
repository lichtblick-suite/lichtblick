// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import { useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import { Time } from "@foxglove/rostime";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { isAbsoluteTime, formatTimeRaw } from "@foxglove/studio-base/util/time";

type Props = {
  disableDate?: boolean;
  horizontal?: boolean;
  time: Time;
};

const useStyles = makeStyles()({
  numericValue: {
    fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, "zero"`,
  },
});

export default function Timestamp(props: Props): JSX.Element {
  const { classes } = useStyles();
  const { disableDate = false, horizontal = false, time } = props;
  const { formatDate, formatTime } = useAppTimeFormat();
  const currentTimeStr = useMemo(() => formatTime(time), [time, formatTime]);
  const rawTimeStr = useMemo(() => formatTimeRaw(time), [time]);
  const date = useMemo(() => formatDate(time), [formatDate, time]);

  if (!isAbsoluteTime(time)) {
    return (
      <Stack direction="row" alignItems="center" flexGrow={0}>
        <Typography className={classes.numericValue} variant="inherit">
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
            className={classes.numericValue}
            noWrap
            fontWeight={!horizontal ? 700 : undefined}
            variant="inherit"
          >
            {date}
          </Typography>
        )}

        <Stack direction="row" alignItems="center" flexShrink={0} gap={0.5}>
          <Typography variant="inherit" className={classes.numericValue}>
            {currentTimeStr}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}
