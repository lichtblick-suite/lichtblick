// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import { useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import { Time } from "@lichtblick/rostime";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useAppTimeFormat } from "@lichtblick/suite-base/hooks";
import { isAbsoluteTime, formatTimeRaw } from "@lichtblick/suite-base/util/time";
import { customTypography } from "@lichtblick/theme";

type Props = {
  disableDate?: boolean;
  horizontal?: boolean;
  time: Time;
  title?: string;
};

const useStyles = makeStyles()(() => ({
  numericValue: {
    fontFeatureSettings: `${customTypography.fontFeatureSettings}, "zero"`,
  },
}));

export default function Timestamp(props: Props): React.JSX.Element {
  const { classes } = useStyles();
  const { disableDate = false, horizontal = false, time, title } = props;
  const { formatDate, formatTime } = useAppTimeFormat();
  const currentTimeStr = useMemo(() => formatTime(time), [time, formatTime]);
  const rawTimeStr = useMemo(() => formatTimeRaw(time), [time]);
  const date = useMemo(() => formatDate(time), [formatDate, time]);

  if (!isAbsoluteTime(time)) {
    return (
      <Stack title={title} direction="row" alignItems="center" flexGrow={0}>
        <Typography className={classes.numericValue} variant="inherit">
          {rawTimeStr}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack
      title={title}
      gap={horizontal ? 0 : 1}
      flexWrap={horizontal ? "nowrap" : "wrap"}
      direction={horizontal ? "row" : "column"}
      alignItems={horizontal ? "center" : "flex-start"}
      justifyContent={horizontal ? "flex-start" : "center"}
    >
      {!disableDate && (
        <>
          <Typography
            className={classes.numericValue}
            noWrap
            fontWeight={!horizontal ? 700 : undefined}
            variant="inherit"
          >
            {date}
          </Typography>
          {horizontal && <>&nbsp;</>}
        </>
      )}

      <Stack direction="row" alignItems="center" flexShrink={0} gap={0.5}>
        <Typography variant="inherit" className={classes.numericValue}>
          {currentTimeStr}
        </Typography>
      </Stack>
    </Stack>
  );
}
