// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Text, useTheme } from "@fluentui/react";
import { useMemo } from "react";

import { Time } from "@foxglove/rostime";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { formatTime } from "@foxglove/studio-base/util/formatTime";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

type Props = {
  time: Time;
};

export default function Timestamp({ time }: Props): JSX.Element {
  const theme = useTheme();

  const { timeFormat, timeZone } = useAppTimeFormat();

  const currentTimeStr = useMemo(() => {
    return timeFormat === "TOD" ? formatTime(time, timeZone) : formatTimeRaw(time);
  }, [time, timeFormat, timeZone]);

  return (
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
  );
}
