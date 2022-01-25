// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ITextStyles, Text, useTheme } from "@fluentui/react";
import { Stack } from "@mui/material";
import { useMemo } from "react";

import Duration from "@foxglove/studio-base/components/Duration";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Timestamp from "@foxglove/studio-base/components/Timestamp";
import { subtractTimes } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/time";

import { MultilineMiddleTruncate } from "./MultilineMiddleTruncate";

const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;
const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;

function DataSourceInfo(): JSX.Element {
  const theme = useTheme();

  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);
  const playerName = useMessagePipeline(selectPlayerName);

  const duration = startTime && endTime ? subtractTimes(endTime, startTime) : undefined;

  const subheaderStyles = useMemo(
    () =>
      ({
        root: {
          fontVariant: "small-caps",
          textTransform: "lowercase",
          color: theme.palette.neutralSecondaryAlt,
          letterSpacing: "0.5px",
          position: "sticky",
          top: 0,
        },
      } as ITextStyles),
    [theme],
  );

  return (
    <Stack spacing={2} sx={{ whiteSpace: "nowrap", overflow: "hidden" }}>
      <Stack direction="row" alignItems="center">
        <Stack flexGrow={1} spacing={0.5} minWidth={0}>
          <Text styles={subheaderStyles}>Current source</Text>
          <Text styles={{ root: { color: theme.palette.neutralSecondary } }}>
            {playerName ? <MultilineMiddleTruncate text={playerName} /> : <>&mdash;</>}
          </Text>
        </Stack>
      </Stack>

      <Stack spacing={0.5}>
        <Text styles={subheaderStyles}>Start time</Text>
        {startTime ? (
          <Timestamp horizontal time={startTime} />
        ) : (
          <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary } }}>
            &mdash;
          </Text>
        )}
      </Stack>

      <Stack spacing={0.5}>
        <Text styles={subheaderStyles}>End time</Text>
        {endTime ? (
          <Timestamp horizontal time={endTime} />
        ) : (
          <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary } }}>
            &mdash;
          </Text>
        )}
      </Stack>

      <Stack spacing={0.5}>
        <Text styles={subheaderStyles}>Duration</Text>
        {duration ? (
          <Duration duration={duration} />
        ) : (
          <Text variant="small" styles={{ root: { color: theme.palette.neutralSecondary } }}>
            &mdash;
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

export { DataSourceInfo };
