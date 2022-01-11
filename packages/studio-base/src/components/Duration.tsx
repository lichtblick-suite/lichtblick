// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, Text, useTheme } from "@fluentui/react";
import { useMemo } from "react";

import { Time } from "@foxglove/rostime";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

type Props = {
  duration: Time;
};

/**
 * Duration component renders a formatted duration { sec, nsec } value according to the current
 * app time format setting.
 *
 * */
export default function Duration(props: Props): JSX.Element {
  const { duration } = props;
  const theme = useTheme();
  const { formatDuration } = useAppTimeFormat();

  const durationStr = useMemo(() => formatDuration(duration), [duration, formatDuration]);

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
        {durationStr}
      </Text>
    </Stack>
  );
}
