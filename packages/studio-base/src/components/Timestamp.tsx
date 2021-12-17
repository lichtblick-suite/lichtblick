// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, Icon, Text, useTheme } from "@fluentui/react";
import { useMemo } from "react";

import { Time } from "@foxglove/rostime";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { formatDate } from "@foxglove/studio-base/util/formatTime";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

type Props = {
  disableDate?: boolean;
  horizontal?: boolean;
  time: Time;
  timezone?: string;
};

const DURATION_20_YEARS_SEC = 20 * 365 * 24 * 60 * 60;

// Values "too small" to be absolute epoch-based times are probably relative durations.
function isAbsoluteTime(time: Time): boolean {
  return time.sec > DURATION_20_YEARS_SEC;
}

export default function Timestamp(props: Props): JSX.Element {
  const { disableDate = false, horizontal = false, time, timezone } = props;
  const theme = useTheme();
  const { formatTime } = useAppTimeFormat();
  const currentTimeStr = useMemo(() => formatTime(time), [time, formatTime]);
  const rawTimeStr = useMemo(() => formatTimeRaw(time), [time]);
  const date = useMemo(() => formatDate(time, timezone), [time, timezone]);

  if (!isAbsoluteTime(time)) {
    return (
      <Stack horizontal verticalAlign="center" grow={0}>
        <Text
          variant="small"
          styles={{
            root: {
              fontFamily: fonts.MONOSPACE,
              color: theme.palette.neutralSecondary,
            },
          }}
        >
          {rawTimeStr}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack tokens={{ childrenGap: theme.spacing.s2 }}>
      <Stack
        horizontal={horizontal}
        verticalAlign="center"
        tokens={{ childrenGap: theme.spacing.s2 }}
      >
        {!disableDate && (
          <>
            <Text
              variant="small"
              styles={{
                root: {
                  fontFamily: fonts.MONOSPACE,
                  color: theme.palette.neutralSecondary,
                  whiteSpace: "nowrap",
                  fontWeight: !horizontal ? 700 : undefined,
                },
              }}
            >
              {date}
            </Text>
            {horizontal && (
              <Icon
                iconName="ChevronRight"
                styles={{
                  root: {
                    opacity: 0.5,
                    svg: { height: "1em", width: "1em" },
                    "> span": { display: "flex" },
                  },
                }}
              />
            )}
          </>
        )}

        <Stack
          horizontal
          disableShrink
          verticalAlign="center"
          tokens={{ childrenGap: theme.spacing.s2 }}
        >
          <Text
            variant="small"
            styles={{
              root: {
                fontFamily: fonts.MONOSPACE,
                color: theme.palette.neutralSecondary,
              },
            }}
          >
            {currentTimeStr}
          </Text>
        </Stack>
      </Stack>
    </Stack>
  );
}
